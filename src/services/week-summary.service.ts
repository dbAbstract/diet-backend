import Anthropic from '@anthropic-ai/sdk'
import { WeekStatus } from '../generated/prisma/client.js'
import { WeekSummaryRepository } from '../repositories/week-summary.repository.js'
import { HistoryRepository } from '../repositories/history.repository.js'
import { WeightRepository } from '../repositories/weight.repository.js'
import { UserRepository } from '../repositories/user.repository.js'
import { calculateDailyCalorieTarget, calculateTDEE } from './tdee.service.js'

// 1 kg of body fat ≈ 7700 kcal
const KCAL_PER_KG = 7700
const MIN_DEFICIT = 200
const MAX_DEFICIT = 750
// Damping factor: only correct 50% of the discrepancy each week to avoid oscillation
const CORRECTION_DAMPING = 0.5

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function makeWeekSummaryService(
  weekSummaryRepo: WeekSummaryRepository,
  historyRepo: HistoryRepository,
  weightRepo: WeightRepository,
  userRepo: UserRepository,
  ai: Anthropic,
  firebaseUid: string,
) {
  async function resolveUser() {
    const user = await userRepo.findByFirebaseUid(firebaseUid)
    if (!user) throw new Error('USER_NOT_FOUND')
    return user
  }

  // Returns the calorie target for the current week by checking the most recently
  // finalized WeekSummary. Falls back to TDEE calculation from user profile.
  async function resolveCurrentCalorieTarget(userId: string, latestWeightKg: number) {
    const user = await userRepo.findByFirebaseUid(firebaseUid)
    if (!user) throw new Error('USER_NOT_FOUND')
    const lastFinalized = await weekSummaryRepo.findLatestFinalized(userId)
    if (lastFinalized?.nextWeekTarget) return lastFinalized.nextWeekTarget
    return calculateDailyCalorieTarget(user, latestWeightKg)
  }

  return {
    // Called on every app open. Lazy-detects if a completed week needs review.
    async getAppState() {
      const user = await resolveUser()

      const todayMonday = getMondayOf(new Date())
      const prevMonday = new Date(todayMonday)
      prevMonday.setDate(prevMonday.getDate() - 7)
      const prevSunday = new Date(todayMonday)
      prevSunday.setDate(prevSunday.getDate() - 1)

      // Resolve current week's calorie target
      const latestWeightEntry = await weightRepo.findAll(user.id).then(all => all[0])
      const latestWeightKg = latestWeightEntry?.weight ?? 80
      const currentCalorieTarget = await resolveCurrentCalorieTarget(user.id, latestWeightKg)

      // Check if previous week needs review
      const existingPrev = await weekSummaryRepo.findByWeekStart(user.id, prevMonday)

      if (existingPrev?.status === WeekStatus.FINALIZED) {
        // Previous week already done — no pending review
        return {
          currentWeek: { weekStart: formatDate(todayMonday), calorieTarget: currentCalorieTarget },
          pendingReview: null,
        }
      }

      if (existingPrev?.status === WeekStatus.PENDING_REVIEW) {
        // Already flagged — just return it
        return {
          currentWeek: { weekStart: formatDate(todayMonday), calorieTarget: currentCalorieTarget },
          pendingReview: await buildPendingReviewPreview(user.id, prevMonday, prevSunday),
        }
      }

      // No record yet — check if there were any logs that week
      const prevLogs = await historyRepo.findLogsInRange(user.id, prevMonday, prevSunday)
      if (prevLogs.length === 0) {
        // Nothing to review
        return {
          currentWeek: { weekStart: formatDate(todayMonday), calorieTarget: currentCalorieTarget },
          pendingReview: null,
        }
      }

      // Create a PENDING_REVIEW record
      await weekSummaryRepo.create({
        userId: user.id,
        weekStart: prevMonday,
        calorieTarget: currentCalorieTarget,
      })

      return {
        currentWeek: { weekStart: formatDate(todayMonday), calorieTarget: currentCalorieTarget },
        pendingReview: await buildPendingReviewPreview(user.id, prevMonday, prevSunday),
      }
    },

    // Finalizes a past week: computes actuals, runs deficit adjustment, persists.
    async finalizeWeek(weekStartStr: string) {
      const user = await resolveUser()
      const weekStart = new Date(weekStartStr)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const existing = await weekSummaryRepo.findByWeekStart(user.id, weekStart)
      if (existing?.status === WeekStatus.FINALIZED) {
        throw new Error('ALREADY_FINALIZED')
      }

      const [logs, weightEntries] = await Promise.all([
        historyRepo.findLogsInRange(user.id, weekStart, weekEnd),
        weightRepo.findInRange(user.id, weekStart, weekEnd),
      ])

      // Compute actuals
      const dailyKcals = logs.map(l => l.entries.reduce((s, e) => s + e.kcal, 0))
      const avgKcal = average(dailyKcals)
      const avgWeight = average(weightEntries.map(w => w.weight))

      const calorieTarget = existing?.calorieTarget ?? calculateDailyCalorieTarget(user, avgWeight ?? 80)
      const adherentDays = dailyKcals.filter(k => k <= calorieTarget).length
      const adherencePct = dailyKcals.length > 0
        ? Math.round((adherentDays / dailyKcals.length) * 100)
        : null

      // Previous week avg weight for delta
      const prevFrom = new Date(weekStart)
      prevFrom.setDate(prevFrom.getDate() - 7)
      const prevTo = new Date(weekStart)
      prevTo.setDate(prevTo.getDate() - 1)
      const prevWeightEntries = await weightRepo.findInRange(user.id, prevFrom, prevTo)
      const prevAvgWeight = average(prevWeightEntries.map(w => w.weight))
      const weightDelta = avgWeight !== null && prevAvgWeight !== null
        ? Math.round((avgWeight - prevAvgWeight) * 100) / 100
        : null

      // Deficit adjustment algorithm
      // Expected loss per week from the deficit (positive = losing weight)
      const currentDeficit = calculateTDEE(user, avgWeight ?? 80) - calorieTarget
      const expectedWeeklyLoss = (currentDeficit * 7) / KCAL_PER_KG
      const expectedDelta = -Math.round(expectedWeeklyLoss * 100) / 100  // negative kg = weight lost

      let nextWeekTarget: number | null = null
      if (weightDelta !== null) {
        const actualWeeklyLoss = -(weightDelta)  // positive = lost weight
        const shortfall = expectedWeeklyLoss - actualWeeklyLoss  // positive = losing slower than expected
        const dailyAdjustment = (shortfall * KCAL_PER_KG / 7) * CORRECTION_DAMPING
        const newDeficit = clamp(currentDeficit + dailyAdjustment, MIN_DEFICIT, MAX_DEFICIT)
        const tdee = calculateTDEE(user, avgWeight ?? 80)
        nextWeekTarget = Math.round(tdee - newDeficit)
      }

      const record = existing
        ? await weekSummaryRepo.update(existing.id, {
            status: WeekStatus.FINALIZED,
            calorieTarget,
            nextWeekTarget,
            avgKcal: avgKcal !== null ? Math.round(avgKcal) : null,
            avgWeight,
            adherentDays,
            adherencePct,
            weightDelta,
            expectedDelta,
            finalizedAt: new Date(),
          })
        : await weekSummaryRepo.create({ userId: user.id, weekStart, calorieTarget }).then(created =>
            weekSummaryRepo.update(created.id, {
              status: WeekStatus.FINALIZED,
              nextWeekTarget,
              avgKcal: avgKcal !== null ? Math.round(avgKcal) : null,
              avgWeight,
              adherentDays,
              adherencePct,
              weightDelta,
              expectedDelta,
              finalizedAt: new Date(),
            })
          )

      return record
    },

    // Generates an LLM insight for a finalized week and stores it.
    async generateInsight(weekStartStr: string) {
      const user = await resolveUser()
      const weekStart = new Date(weekStartStr)
      const summary = await weekSummaryRepo.findByWeekStart(user.id, weekStart)

      if (!summary) throw new Error('WEEK_NOT_FOUND')
      if (summary.status !== WeekStatus.FINALIZED) throw new Error('NOT_FINALIZED')

      const prompt = buildInsightPrompt(summary, user.name)
      const message = await ai.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      })

      const insight = message.content[0].type === 'text' ? message.content[0].text : ''
      await weekSummaryRepo.update(summary.id, { aiInsight: insight })
      return { insight }
    },
  }

  async function buildPendingReviewPreview(userId: string, from: Date, to: Date) {
    const [logs, weightEntries] = await Promise.all([
      historyRepo.findLogsInRange(userId, from, to),
      weightRepo.findInRange(userId, from, to),
    ])
    const dailyKcals = logs.map(l => l.entries.reduce((s, e) => s + e.kcal, 0))
    return {
      weekStart: formatDate(from),
      daysLogged: logs.length,
      avgKcal: average(dailyKcals) !== null ? Math.round(average(dailyKcals)!) : null,
      avgWeight: average(weightEntries.map(w => w.weight)) !== null
        ? Math.round(average(weightEntries.map(w => w.weight))! * 10) / 10
        : null,
    }
  }
}

function buildInsightPrompt(
  summary: {
    avgKcal: number | null
    calorieTarget: number
    adherencePct: number | null
    adherentDays: number | null
    weightDelta: number | null
    expectedDelta: number | null
    nextWeekTarget: number | null
  },
  userName: string
): string {
  const lines = [
    `You are a supportive diet coach. Write a brief (2-3 sentences) weekly insight for ${userName}.`,
    `Data for the week:`,
    `- Calorie target: ${summary.calorieTarget} kcal/day`,
    `- Avg actual kcal: ${summary.avgKcal ?? 'unknown'} kcal/day`,
    `- Adherent days: ${summary.adherentDays ?? 0} out of days logged`,
    `- Adherence: ${summary.adherencePct ?? 'unknown'}%`,
    `- Weight change: ${summary.weightDelta !== null ? `${summary.weightDelta > 0 ? '+' : ''}${summary.weightDelta} kg` : 'unknown (no weight logged)'}`,
    `- Expected weight change: ${summary.expectedDelta !== null ? `${summary.expectedDelta} kg` : 'unknown'}`,
    `- Next week's calorie target: ${summary.nextWeekTarget ?? summary.calorieTarget} kcal/day`,
    ``,
    `Be honest but encouraging. Mention the weight trend if available. Keep it under 60 words.`,
  ]
  return lines.join('\n')
}

export type WeekSummaryService = ReturnType<typeof makeWeekSummaryService>
