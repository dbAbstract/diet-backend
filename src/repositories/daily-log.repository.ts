import { PrismaClient, MealType } from '../generated/prisma/client.js'

export type CreateMealEntryInput = {
  dailyLogId: string
  mealType: MealType
  quantity: number
  notes?: string
  foodItemId?: string
  recipeId?: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export type UpdateMealEntryInput = {
  mealType?: MealType
  quantity?: number
  notes?: string
}

const entryIncludes = {
  include: {
    entries: {
      orderBy: { loggedAt: 'asc' as const },
    },
  },
}

export function makeDailyLogRepository(db: PrismaClient) {
  return {
    findByDate(userId: string, date: Date) {
      return db.dailyLog.findUnique({
        where: { userId_date: { userId, date } },
        ...entryIncludes,
      })
    },

    create(userId: string, date: Date) {
      return db.dailyLog.create({
        data: { userId, date },
        ...entryIncludes,
      })
    },

    addEntry(data: CreateMealEntryInput) {
      return db.mealEntry.create({ data })
    },

    updateEntry(id: string, data: UpdateMealEntryInput) {
      return db.mealEntry.update({ where: { id }, data })
    },

    deleteEntry(id: string) {
      return db.mealEntry.delete({ where: { id } })
    },

    findEntryById(id: string) {
      return db.mealEntry.findUnique({ where: { id } })
    },
  }
}

export type DailyLogRepository = ReturnType<typeof makeDailyLogRepository>
