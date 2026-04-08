import { PrismaClient, FoodSource } from '../generated/prisma/client.js'

export type CreateFoodItemInput = {
  name: string
  servingSize: number
  servingLabel: string
  source: FoodSource
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export type UpdateFoodItemInput = Partial<CreateFoodItemInput>

export function makeFoodItemRepository(db: PrismaClient) {
  return {
    findAll(search?: string) {
      return db.foodItem.findMany({
        where: search
          ? { name: { contains: search, mode: 'insensitive' } }
          : undefined,
        orderBy: { name: 'asc' },
      })
    },

    findById(id: string) {
      return db.foodItem.findUnique({ where: { id } })
    },

    create(data: CreateFoodItemInput) {
      return db.foodItem.create({ data })
    },

    update(id: string, data: UpdateFoodItemInput) {
      return db.foodItem.update({ where: { id }, data })
    },

    delete(id: string) {
      return db.foodItem.delete({ where: { id } })
    },

    async findRecent(userId: string, limit: number = 10) {
      const recentEntries = await db.mealEntry.findMany({
        where: {
          dailyLog: { userId },
          foodItemId: { not: null },
        },
        orderBy: { loggedAt: 'desc' },
        distinct: ['foodItemId'],
        take: limit,
        select: { foodItemId: true },
      })

      const ids = recentEntries.map(e => e.foodItemId!)
      if (ids.length === 0) return []

      const items = await db.foodItem.findMany({ where: { id: { in: ids } } })

      // Restore recency order
      return ids.map(id => items.find(item => item.id === id)!).filter(Boolean)
    },
  }
}

export type FoodItemRepository = ReturnType<typeof makeFoodItemRepository>
