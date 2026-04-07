import { HistoryRepository } from '../repositories/history.repository.js'
import { WeightRepository } from '../repositories/weight.repository.js'
import { UserRepository } from '../repositories/user.repository.js'
import { calculateDailyCalorieTarget } from './tdee.service.js'

// Weeks always start on Monday (ISO standard)
function getWeekBounds(weekStartStr: string): { from: Date; to: Date } {
  const from = new Date(weekStartStr)
  const to = new Date(from)
  to.setDate(to.getDate() + 6)
  return { from, to }
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Sunday = 0, shift back to Monday
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function average(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function makeHistoryService(
  historyRepo: HistoryRepository,
  weightRepo: WeightRepository,
  userRepo: UserRepository
) {
  async function resolveUser() {
    const user = await userRepo.findFirst()
    if (!user) throw new Error('USER_NOT_FOUND')
    return user
  }

  return {
    async getWeekSummary(weekStartStr: string) {
      const user = await resolveUser()
      const { from, to } = getWeekBounds(weekStartStr)

      const [logs, weightEntries] = await Promise.all([
        historyRepo.findLogsInRange(user.id, from, to),
        weightRepo.findInRange(user.id, from, to),
      ])

      // Build a map of date → data for quick lookup
      const logByDate = new Map(logs.map(l => [formatDate(l.date), l]))
      const weightByDate = new Map(weightEntries.map(w => [formatDate(w.date), w]))

      // Build one entry per day of the week
      const days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(from)
        date.setDate(date.getDate() + i)
        const dateStr = formatDate(date)
        const log = logByDate.get(dateStr)
        const weightEntry = weightByDate.get(dateStr)

        const kcal = log ? log.entries.reduce((sum, e) => sum + e.kcal, 0) : null
        const protein = log ? log.entries.reduce((sum, e) => sum + e.protein, 0) : null
        const carbs = log ? log.entries.reduce((sum, e) => sum + e.carbs, 0) : null
        const fat = log ? log.entries.reduce((sum, e) => sum + e.fat, 0) : null

        return {
          date: dateStr,
          kcal,
          protein,
          carbs,
          fat,
          weight: weightEntry?.weight ?? null,
          bodyFatPct: weightEntry?.bodyFatPct ?? null,
        }
      })

      // Use the most recent weight entry this week for TDEE (fall back to first available ever)
      const latestWeight = weightEntries.at(-1) ?? await weightRepo.findAll(user.id).then(all => all[0])
      const weightKg = latestWeight?.weight ?? 80 // fallback if no weight logged yet
      const dailyCalorieTarget = calculateDailyCalorieTarget(user, weightKg)

      // Weekly summary stats
      const loggedKcals = days.map(d => d.kcal).filter((k): k is number => k !== null)
      const loggedWeights = days.map(d => d.weight).filter((w): w is number => w !== null)

      const avgKcal = average(loggedKcals)
      const avgWeight = average(loggedWeights)
      const adherentDays = loggedKcals.filter(k => k <= dailyCalorieTarget).length

      // Previous week for weight trend
      const prevFrom = new Date(from)
      prevFrom.setDate(prevFrom.getDate() - 7)
      const prevTo = new Date(from)
      prevTo.setDate(prevTo.getDate() - 1)
      const prevWeightEntries = await weightRepo.findInRange(user.id, prevFrom, prevTo)
      const prevAvgWeight = average(prevWeightEntries.map(w => w.weight))
      const weightChange = avgWeight !== null && prevAvgWeight !== null
        ? Math.round((avgWeight - prevAvgWeight) * 100) / 100
        : null

      return {
        weekStart: weekStartStr,
        weekEnd: formatDate(to),
        dailyCalorieTarget,
        days,
        summary: {
          avgKcal: avgKcal !== null ? Math.round(avgKcal) : null,
          avgWeight: avgWeight !== null ? Math.round(avgWeight * 10) / 10 : null,
          weightChange,
          daysLogged: loggedKcals.length,
          adherentDays,
          adherencePct: loggedKcals.length > 0
            ? Math.round((adherentDays / loggedKcals.length) * 100)
            : null,
        },
      }
    },

    async listWeeks(page: number, pageSize: number) {
      const user = await resolveUser()

      const [logs, total] = await Promise.all([
        historyRepo.findWeeksWithLogs(user.id, page, pageSize),
        historyRepo.countLogsTotal(user.id),
      ])

      // Deduplicate to unique Monday-anchored weeks
      const weekStarts = [...new Set(
        logs.map(l => formatDate(getMondayOfWeek(l.date)))
      )]

      return {
        page,
        pageSize,
        total: Math.ceil(total / 7), // approximate number of weeks
        weeks: weekStarts,
      }
    },
  }
}
