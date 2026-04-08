import { WeightRepository } from '../repositories/weight.repository.js'
import { UserRepository } from '../repositories/user.repository.js'

export function makeWeightService(weightRepo: WeightRepository, userRepo: UserRepository) {
  async function resolveUser() {
    const user = await userRepo.findFirst()
    if (!user) throw new Error('NOT_FOUND')
    return user
  }

  return {
    async listWeightEntries(from?: Date, to?: Date) {
      const user = await resolveUser()
      if (from && to) return weightRepo.findInRange(user.id, from, to)
      return weightRepo.findAll(user.id)
    },

    async logWeight(weight: number, bodyFatPct?: number, date?: Date) {
      const user = await resolveUser()
      return weightRepo.create({
        userId: user.id,
        weight,
        bodyFatPct,
        date: date ?? new Date(),
      })
    },

    async deleteWeightEntry(id: string) {
      return weightRepo.delete(id)
    },
  }
}
