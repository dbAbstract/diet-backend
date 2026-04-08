import { ActivitySource } from '../generated/prisma/client.js'
import { ActivityRepository } from '../repositories/activity.repository.js'
import { UserRepository } from '../repositories/user.repository.js'
import { WeightRepository } from '../repositories/weight.repository.js'

export function makeActivityService(
  activityRepo: ActivityRepository,
  userRepo: UserRepository,
  weightRepo: WeightRepository,
  firebaseUid: string,
) {
  async function resolveUser() {
    const user = await userRepo.findByFirebaseUid(firebaseUid)
    if (!user) throw new Error('USER_NOT_FOUND')
    return user
  }

  return {
    async listActivityEntries(from?: Date, to?: Date) {
      const user = await resolveUser()
      if (from && to) return activityRepo.findInRange(user.id, from, to)
      return activityRepo.findAll(user.id)
    },

    async logActivity(input: {
      date?: Date
      description: string
      kcalBurned: number
      source?: ActivitySource
    }) {
      const user = await resolveUser()
      return activityRepo.create({
        userId: user.id,
        date: input.date ?? new Date(),
        description: input.description,
        kcalBurned: input.kcalBurned,
        source: input.source ?? ActivitySource.MANUAL,
      })
    },

    async deleteActivityEntry(id: string) {
      return activityRepo.delete(id)
    },

    async getLatestWeightKg(): Promise<number> {
      const user = await resolveUser()
      const entries = await weightRepo.findAll(user.id)
      return entries[0]?.weight ?? 80
    },
  }
}
