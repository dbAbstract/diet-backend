import { DailyLogRepository, UpdateMealEntryInput } from '../repositories/daily-log.repository.js'
import { FoodItemRepository } from '../repositories/food-item.repository.js'
import { RecipeRepository } from '../repositories/recipe.repository.js'
import { UserRepository } from '../repositories/user.repository.js'
import { MealType } from '../generated/prisma/client.js'

export type LogMealInput = {
  mealType: MealType
  quantity: number
  notes?: string
  foodItemId?: string
  recipeId?: string
}

function computeFoodItemMacros(foodItem: { kcal: number; protein: number; carbs: number; fat: number; fiber: number }, quantity: number) {
  return {
    kcal: foodItem.kcal * quantity,
    protein: foodItem.protein * quantity,
    carbs: foodItem.carbs * quantity,
    fat: foodItem.fat * quantity,
    fiber: foodItem.fiber * quantity,
  }
}

function computeRecipeMacros(ingredients: { quantity: number; foodItem: { kcal: number; protein: number; carbs: number; fat: number; fiber: number } }[], quantity: number) {
  const perServing = ingredients.reduce(
    (acc, { foodItem, quantity: ingQty }) => ({
      kcal: acc.kcal + foodItem.kcal * ingQty,
      protein: acc.protein + foodItem.protein * ingQty,
      carbs: acc.carbs + foodItem.carbs * ingQty,
      fat: acc.fat + foodItem.fat * ingQty,
      fiber: acc.fiber + foodItem.fiber * ingQty,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )
  return {
    kcal: perServing.kcal * quantity,
    protein: perServing.protein * quantity,
    carbs: perServing.carbs * quantity,
    fat: perServing.fat * quantity,
    fiber: perServing.fiber * quantity,
  }
}

export function makeDailyLogService(
  logRepo: DailyLogRepository,
  foodRepo: FoodItemRepository,
  recipeRepo: RecipeRepository,
  userRepo: UserRepository
) {
  async function resolveUser() {
    const user = await userRepo.findFirst()
    if (!user) throw new Error('USER_NOT_FOUND')
    return user
  }

  async function getOrCreateLog(userId: string, date: Date) {
    const existing = await logRepo.findByDate(userId, date)
    if (existing) return existing
    return logRepo.create(userId, date)
  }

  return {
    async getDailyLog(dateStr: string) {
      const user = await resolveUser()
      const date = new Date(dateStr)
      return getOrCreateLog(user.id, date)
    },

    async logMeal(dateStr: string, input: LogMealInput) {
      if (!input.foodItemId && !input.recipeId) {
        throw new Error('MISSING_FOOD_SOURCE')
      }
      if (input.foodItemId && input.recipeId) {
        throw new Error('AMBIGUOUS_FOOD_SOURCE')
      }

      const user = await resolveUser()
      const date = new Date(dateStr)
      const log = await getOrCreateLog(user.id, date)

      let macros: { kcal: number; protein: number; carbs: number; fat: number; fiber: number }

      if (input.foodItemId) {
        const foodItem = await foodRepo.findById(input.foodItemId)
        if (!foodItem) throw new Error('FOOD_NOT_FOUND')
        macros = computeFoodItemMacros(foodItem, input.quantity)
      } else {
        const recipe = await recipeRepo.findById(input.recipeId!)
        if (!recipe) throw new Error('RECIPE_NOT_FOUND')
        macros = computeRecipeMacros(recipe.ingredients, input.quantity)
      }

      return logRepo.addEntry({
        dailyLogId: log.id,
        mealType: input.mealType,
        quantity: input.quantity,
        notes: input.notes,
        foodItemId: input.foodItemId,
        recipeId: input.recipeId,
        ...macros,
      })
    },

    async updateMealEntry(entryId: string, data: UpdateMealEntryInput) {
      const entry = await logRepo.findEntryById(entryId)
      if (!entry) throw new Error('NOT_FOUND')
      return logRepo.updateEntry(entryId, data)
    },

    async deleteMealEntry(entryId: string) {
      const entry = await logRepo.findEntryById(entryId)
      if (!entry) throw new Error('NOT_FOUND')
      return logRepo.deleteEntry(entryId)
    },

    async getDailySummary(dateStr: string) {
      const user = await resolveUser()
      const date = new Date(dateStr)
      const log = await getOrCreateLog(user.id, date)

      const totals = log.entries.reduce(
        (acc, entry) => ({
          kcal: acc.kcal + entry.kcal,
          protein: acc.protein + entry.protein,
          carbs: acc.carbs + entry.carbs,
          fat: acc.fat + entry.fat,
          fiber: acc.fiber + entry.fiber,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
      )

      return {
        date: dateStr,
        totals,
        targets: {
          protein: user.targetProtein,
          carbs: user.targetCarbs,
          fat: user.targetFat,
        },
        entries: log.entries,
      }
    },
  }
}
