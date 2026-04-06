import { RecipeRepository, CreateRecipeInput } from '../repositories/recipe.repository.js'

type FoodItem = {
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

type Ingredient = {
  quantity: number
  foodItem: FoodItem
}

function computeMacros(ingredients: Ingredient[]) {
  return ingredients.reduce(
    (acc, { foodItem, quantity }) => ({
      kcal: acc.kcal + foodItem.kcal * quantity,
      protein: acc.protein + foodItem.protein * quantity,
      carbs: acc.carbs + foodItem.carbs * quantity,
      fat: acc.fat + foodItem.fat * quantity,
      fiber: acc.fiber + foodItem.fiber * quantity,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  )
}

export function makeRecipeService(repo: RecipeRepository) {
  return {
    async listRecipes() {
      const recipes = await repo.findAll()
      return recipes.map((r) => ({ ...r, macros: computeMacros(r.ingredients) }))
    },

    async getRecipe(id: string) {
      const recipe = await repo.findById(id)
      if (!recipe) throw new Error('NOT_FOUND')
      return { ...recipe, macros: computeMacros(recipe.ingredients) }
    },

    async createRecipe(data: CreateRecipeInput) {
      const recipe = await repo.create(data)
      return { ...recipe, macros: computeMacros(recipe.ingredients) }
    },

    async updateRecipe(id: string, data: Partial<CreateRecipeInput>) {
      const existing = await repo.findById(id)
      if (!existing) throw new Error('NOT_FOUND')
      const recipe = await repo.update(id, data)
      return { ...recipe, macros: computeMacros(recipe.ingredients) }
    },

    async deleteRecipe(id: string) {
      const existing = await repo.findById(id)
      if (!existing) throw new Error('NOT_FOUND')
      return repo.delete(id)
    },
  }
}
