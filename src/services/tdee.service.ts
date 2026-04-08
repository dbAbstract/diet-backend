import { Sex, ActivityLevel } from '../generated/prisma/client.js'

type UserProfile = {
  sex: Sex
  height: number      // cm
  dateOfBirth: Date
  dailyDeficitKcal: number
  activityLevel: ActivityLevel
}

// NEAT-only multipliers — intentional exercise is tracked separately via ActivityEntry.
// These represent non-exercise activity thermogenesis (NEAT) only.
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]:      1.2,    // Desk job, car commute, minimal daily movement
  [ActivityLevel.LIGHTLY_ACTIVE]: 1.375,  // On feet regularly — retail, teaching, nursing, walking commute
}

export const ACTIVITY_LEVEL_METADATA = [
  {
    level: ActivityLevel.SEDENTARY,
    label: 'Sedentary',
    multiplier: 1.2,
    description:
      "You spend most of your day sitting — desk job, driving or taking transit, and minimal walking beyond getting from A to B. No exercise is assumed. Any workouts you do get logged separately and added to your daily allowance.",
  },
  {
    level: ActivityLevel.LIGHTLY_ACTIVE,
    label: 'Lightly Active',
    multiplier: 1.375,
    description:
      "You're on your feet for a significant part of your day as a natural part of your routine — retail, teaching, nursing, an active commute, or similar. This covers incidental daily movement only, not intentional exercise. Any workouts you do get logged separately and added to your daily allowance.",
  },
] as const

function calculateAge(dateOfBirth: Date): number {
  const today = new Date()
  const age = today.getFullYear() - dateOfBirth.getFullYear()
  const hasHadBirthdayThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() && today.getDate() >= dateOfBirth.getDate())
  return hasHadBirthdayThisYear ? age : age - 1
}

// Mifflin-St Jeor BMR
function calculateBMR(user: UserProfile, weightKg: number): number {
  const age = calculateAge(user.dateOfBirth)
  const base = 10 * weightKg + 6.25 * user.height - 5 * age
  return user.sex === Sex.MALE ? base + 5 : base - 161
}

export function calculateTDEE(user: UserProfile, weightKg: number): number {
  const multiplier = ACTIVITY_MULTIPLIERS[user.activityLevel]
  return Math.round(calculateBMR(user, weightKg) * multiplier)
}

export function calculateDailyCalorieTarget(user: UserProfile, weightKg: number): number {
  return Math.round(calculateTDEE(user, weightKg) - user.dailyDeficitKcal)
}
