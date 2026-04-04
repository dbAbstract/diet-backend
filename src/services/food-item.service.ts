import { FoodItemRepository, CreateFoodItemInput, UpdateFoodItemInput } from '../repositories/food-item.repository.js'

export function makeFoodItemService(repo: FoodItemRepository) {
  return {
    listFoodItems(search?: string) {
      return repo.findAll(search)
    },

    async getFoodItem(id: string) {
      const item = await repo.findById(id)
      if (!item) throw new Error('NOT_FOUND')
      return item
    },

    createFoodItem(data: CreateFoodItemInput) {
      return repo.create(data)
    },

    async updateFoodItem(id: string, data: UpdateFoodItemInput) {
      const existing = await repo.findById(id)
      if (!existing) throw new Error('NOT_FOUND')
      return repo.update(id, data)
    },

    async deleteFoodItem(id: string) {
      const existing = await repo.findById(id)
      if (!existing) throw new Error('NOT_FOUND')
      return repo.delete(id)
    },
  }
}
