import { FoodItemRepository, CreateFoodItemInput, UpdateFoodItemInput } from '../repositories/food-item.repository.js'
import { UserRepository } from '../repositories/user.repository.js'

export function makeFoodItemService(repo: FoodItemRepository, userRepo: UserRepository) {
  async function resolveUser() {
    const user = await userRepo.findFirst()
    if (!user) throw new Error('USER_NOT_FOUND')
    return user
  }

  return {
    listFoodItems(search?: string) {
      return repo.findAll(search)
    },

    async listRecentFoodItems(limit: number = 10) {
      const user = await resolveUser()
      return repo.findRecent(user.id, limit)
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
