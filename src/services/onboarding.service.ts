import { Sex, ActivityLevel } from '../generated/prisma/client.js'
import { ACTIVITY_LEVEL_METADATA, calculateTDEE, calculateDailyCalorieTarget } from './tdee.service.js'

// ─── Step definitions ────────────────────────────────────────────────────────

export type Validation = {
  required?: boolean
  min?: number
  max?: number
  step?: number
  maxLength?: number
}

export type SelectOption = {
  value: string
  label: string
  description?: string
}

export type DeficitBand = {
  label: string
  min: number
  max: number
  weeklyLossKg: { min: number; max: number }
  description: string
}

type BaseStep = {
  key: string
  title: string
  subtitle?: string
}

export type TextInputStep = BaseStep & {
  type: 'TEXT_INPUT'
  placeholder?: string
  validation?: Validation
}

export type DateInputStep = BaseStep & {
  type: 'DATE_INPUT'
}

export type NumberInputStep = BaseStep & {
  type: 'NUMBER_INPUT'
  unit: string
  validation?: Validation
}

export type SingleSelectStep = BaseStep & {
  type: 'SINGLE_SELECT'
  options: SelectOption[]
}

export type RangePickerStep = BaseStep & {
  type: 'RANGE_PICKER'
  unit: string
  picker: { min: number; max: number; step: number; default: number }
  bands: DeficitBand[]
}

export type GoalSuggestionStep = BaseStep & {
  type: 'GOAL_SUGGESTION'
  unit: string
  validation?: Validation
  requiresFields: string[]
  suggestionEndpoint: string
}

export type SummaryStep = BaseStep & {
  type: 'SUMMARY'
  requiresFields: string[]
  calculationEndpoint: string
}

export type OnboardingStep =
  | TextInputStep
  | DateInputStep
  | NumberInputStep
  | SingleSelectStep
  | RangePickerStep
  | GoalSuggestionStep
  | SummaryStep

// ─── Deficit bands ────────────────────────────────────────────────────────────

const DEFICIT_BANDS: DeficitBand[] = [
  {
    label: 'Gentle',
    min: 100,
    max: 250,
    weeklyLossKg: { min: 0.09, max: 0.23 },
    description: 'Sustainable and easy to maintain. Best for building long-term habits without feeling deprived.',
  },
  {
    label: 'Moderate',
    min: 250,
    max: 500,
    weeklyLossKg: { min: 0.23, max: 0.45 },
    description: 'A solid balance between meaningful progress and day-to-day sustainability.',
  },
  {
    label: 'Aggressive',
    min: 500,
    max: 750,
    weeklyLossKg: { min: 0.45, max: 0.68 },
    description: 'Faster results but harder to stick to. Not recommended for more than a few weeks at a time.',
  },
]

// ─── Body fat estimation ──────────────────────────────────────────────────────

// Deurenberg formula: BF% = (1.2 × BMI) + (0.23 × age) − (10.8 × sexFactor) − 5.4
// sexFactor: 1 = male, 0 = female
function estimateBodyFatPct(bmi: number, age: number, sex: Sex): number {
  const sexFactor = sex === Sex.MALE ? 1 : 0
  return Math.round(((1.2 * bmi) + (0.23 * age) - (10.8 * sexFactor) - 5.4) * 10) / 10
}

type BodyFatCategory = {
  estimatedPct: number
  range: { min: number; max: number }
  category: string
}

function classifyBodyFat(pct: number, sex: Sex): BodyFatCategory {
  const ranges =
    sex === Sex.MALE
      ? [
          { category: 'Essential', min: 2, max: 5 },
          { category: 'Athletic', min: 6, max: 13 },
          { category: 'Fitness', min: 14, max: 17 },
          { category: 'Average', min: 18, max: 24 },
          { category: 'Obese', min: 25, max: 60 },
        ]
      : [
          { category: 'Essential', min: 10, max: 13 },
          { category: 'Athletic', min: 14, max: 20 },
          { category: 'Fitness', min: 21, max: 24 },
          { category: 'Average', min: 25, max: 31 },
          { category: 'Obese', min: 32, max: 70 },
        ]

  const match = ranges.find(r => pct >= r.min && pct <= r.max) ?? ranges[ranges.length - 1]
  return { estimatedPct: pct, range: { min: match.min, max: match.max }, category: match.category }
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date()
  const age = today.getFullYear() - dateOfBirth.getFullYear()
  const hasHadBirthday =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() && today.getDate() >= dateOfBirth.getDate())
  return hasHadBirthday ? age : age - 1
}

function calculateBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10
}

// ─── Onboarding service ───────────────────────────────────────────────────────

export function makeOnboardingService() {
  function getSteps(): OnboardingStep[] {
    return [
      {
        key: 'name',
        type: 'TEXT_INPUT',
        title: "What's your name?",
        subtitle: "We'll use this to personalise your experience",
        placeholder: 'Your name',
        validation: { required: true, maxLength: 50 },
      },
      {
        key: 'sex',
        type: 'SINGLE_SELECT',
        title: 'Biological sex',
        subtitle: 'Used for accurate calorie calculations — the formula differs by sex',
        options: [
          { value: 'MALE', label: 'Male' },
          { value: 'FEMALE', label: 'Female' },
        ],
      },
      {
        key: 'dateOfBirth',
        type: 'DATE_INPUT',
        title: 'When were you born?',
        subtitle: 'Age affects your metabolic rate',
      },
      {
        key: 'height',
        type: 'NUMBER_INPUT',
        title: 'How tall are you?',
        unit: 'cm',
        validation: { min: 100, max: 250, step: 1 },
      },
      {
        key: 'currentWeightKg',
        type: 'NUMBER_INPUT',
        title: 'Current weight',
        subtitle: "We'll track your progress from here",
        unit: 'kg',
        validation: { min: 30, max: 300, step: 0.1 },
      },
      {
        key: 'activityLevel',
        type: 'SINGLE_SELECT',
        title: 'Daily activity level',
        subtitle: 'Your baseline movement — not counting exercise. Workouts are logged separately and added to your daily allowance.',
        options: ACTIVITY_LEVEL_METADATA.map(m => ({
          value: m.level,
          label: m.label,
          description: m.description,
        })),
      },
      {
        key: 'targetWeightKg',
        type: 'GOAL_SUGGESTION',
        title: "What's your goal weight?",
        subtitle: "We've suggested a target based on a healthy BMI for your height",
        unit: 'kg',
        validation: { min: 30, max: 300, step: 0.1 },
        requiresFields: ['sex', 'height', 'dateOfBirth', 'currentWeightKg'],
        suggestionEndpoint: '/onboarding/goal-suggestion',
      },
      {
        key: 'dailyDeficitKcal',
        type: 'RANGE_PICKER',
        title: 'How fast do you want to lose weight?',
        subtitle: 'You can change this any time — the app also adjusts it automatically based on your weekly results',
        unit: 'kcal/day',
        picker: { min: 100, max: 750, step: 50, default: 400 },
        bands: DEFICIT_BANDS,
      },
      {
        key: 'summary',
        type: 'SUMMARY',
        title: 'Your plan',
        subtitle: 'Based on your profile — adjust macros before confirming if needed',
        requiresFields: ['sex', 'height', 'dateOfBirth', 'currentWeightKg', 'activityLevel', 'dailyDeficitKcal'],
        calculationEndpoint: '/onboarding/summary',
      },
    ]
  }

  function goalSuggestion(input: {
    sex: Sex
    height: number
    dateOfBirth: Date
    currentWeightKg: number
  }) {
    const { sex, height, dateOfBirth, currentWeightKg } = input
    const age = calculateAge(dateOfBirth)
    const heightM = height / 100

    const currentBmi = calculateBmi(currentWeightKg, height)
    const currentBf = estimateBodyFatPct(currentBmi, age, sex)

    // Suggest BMI of 22 — midpoint of healthy range (18.5–24.9)
    const suggestedTargetKg = Math.round(22 * heightM * heightM * 10) / 10
    const targetBmi = calculateBmi(suggestedTargetKg, height)
    const targetBf = estimateBodyFatPct(targetBmi, age, sex)

    return {
      suggestedTargetKg,
      current: {
        weightKg: currentWeightKg,
        bmi: currentBmi,
        bodyFat: classifyBodyFat(currentBf, sex),
      },
      target: {
        weightKg: suggestedTargetKg,
        bmi: targetBmi,
        bodyFat: classifyBodyFat(targetBf, sex),
      },
    }
  }

  function calculateSummary(input: {
    sex: Sex
    height: number
    dateOfBirth: Date
    currentWeightKg: number
    activityLevel: ActivityLevel
    dailyDeficitKcal: number
  }) {
    const { sex, height, dateOfBirth, currentWeightKg, activityLevel, dailyDeficitKcal } = input

    const userProfile = { sex, height, dateOfBirth, activityLevel, dailyDeficitKcal }
    const tdee = calculateTDEE(userProfile, currentWeightKg)
    const dailyCalorieTarget = calculateDailyCalorieTarget(userProfile, currentWeightKg)
    const weeklyLossKg = Math.round((dailyDeficitKcal * 7 / 7700) * 100) / 100

    // Macro suggestions:
    // Protein: 2g per kg bodyweight (muscle preservation during deficit)
    // Fat: 25% of calorie target
    // Carbs: remainder
    const protein = Math.round(2 * currentWeightKg)
    const fat = Math.round((dailyCalorieTarget * 0.25) / 9)
    const carbsKcal = dailyCalorieTarget - (protein * 4) - (fat * 9)
    const carbs = Math.max(50, Math.round(carbsKcal / 4))

    return {
      tdee,
      dailyCalorieTarget,
      weeklyLossKg,
      suggestedMacros: { protein, carbs, fat },
    }
  }

  return { getSteps, goalSuggestion, calculateSummary }
}
