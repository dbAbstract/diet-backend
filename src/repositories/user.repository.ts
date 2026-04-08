import { PrismaClient, Sex, ActivityLevel } from '../generated/prisma/client.js'

export type CreateUserInput = {
  firebaseUid: string
  name: string
  sex: Sex
  height: number
  dateOfBirth: Date
  activityLevel: ActivityLevel
  targetWeightKg: number
  dailyDeficitKcal: number
  targetProtein: number
  targetCarbs: number
  targetFat: number
}

export type UpdateUserInput = Partial<Omit<CreateUserInput, 'firebaseUid'>>

export function makeUserRepository(db: PrismaClient) {
  return {
    findByFirebaseUid(firebaseUid: string) {
      return db.user.findUnique({ where: { firebaseUid } })
    },

    create(data: CreateUserInput) {
      return db.user.create({ data })
    },

    update(id: string, data: UpdateUserInput) {
      return db.user.update({ where: { id }, data })
    },
  }
}

export type UserRepository = ReturnType<typeof makeUserRepository>
