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

    async findRecentMeals(userId: string, limit: number = 20) {
      const [recentFoodEntries, recentRecipeEntries] = await Promise.all([
        db.mealEntry.findMany({
          where: { dailyLog: { userId }, foodItemId: { not: null } },
          orderBy: { loggedAt: 'desc' },
          distinct: ['foodItemId'],
          take: limit,
          select: { foodItemId: true, loggedAt: true },
        }),
        db.mealEntry.findMany({
          where: { dailyLog: { userId }, recipeId: { not: null } },
          orderBy: { loggedAt: 'desc' },
          distinct: ['recipeId'],
          take: limit,
          select: { recipeId: true, loggedAt: true },
        }),
      ])

      const [foodItems, recipes] = await Promise.all([
        recentFoodEntries.length > 0
          ? db.foodItem.findMany({ where: { id: { in: recentFoodEntries.map(e => e.foodItemId!) } } })
          : Promise.resolve([]),
        recentRecipeEntries.length > 0
          ? db.recipe.findMany({
              where: { id: { in: recentRecipeEntries.map(e => e.recipeId!) } },
              include: { ingredients: { include: { foodItem: true } } },
            })
          : Promise.resolve([]),
      ])

      const merged = [
        ...recentFoodEntries.map(e => ({
          type: 'food_item' as const,
          lastLoggedAt: e.loggedAt,
          foodItem: foodItems.find(f => f.id === e.foodItemId)!,
        })),
        ...recentRecipeEntries.map(e => ({
          type: 'recipe' as const,
          lastLoggedAt: e.loggedAt,
          recipe: recipes.find(r => r.id === e.recipeId)!,
        })),
      ]

      return merged
        .sort((a, b) => b.lastLoggedAt.getTime() - a.lastLoggedAt.getTime())
        .slice(0, limit)
    },
  }
}

export type DailyLogRepository = ReturnType<typeof makeDailyLogRepository>
