import { Sex } from '../generated/prisma/client.js'

type UserProfile = {
  sex: Sex
  height: number      // cm
  dateOfBirth: Date
  dailyDeficitKcal: number
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date()
  const age = today.getFullYear() - dateOfBirth.getFullYear()
  const hasHadBirthdayThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() && today.getDate() >= dateOfBirth.getDate())
  return hasHadBirthdayThisYear ? age : age - 1
}

// Mifflin-St Jeor BMR formula
function calculateBMR(user: UserProfile, weightKg: number): number {
  const age = calculateAge(user.dateOfBirth)
  const base = 10 * weightKg + 6.25 * user.height - 5 * age
  return user.sex === Sex.MALE ? base + 5 : base - 161
}

// Mildly active: exercises 3-4x/week
const ACTIVITY_FACTOR = 1.55

export function calculateTDEE(user: UserProfile, weightKg: number): number {
  return Math.round(calculateBMR(user, weightKg) * ACTIVITY_FACTOR)
}

export function calculateDailyCalorieTarget(user: UserProfile, weightKg: number): number {
  return Math.round(calculateTDEE(user, weightKg) - user.dailyDeficitKcal)
}
