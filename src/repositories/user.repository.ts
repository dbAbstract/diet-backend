import { PrismaClient, Sex, ActivityLevel } from '../generated/prisma/client.js'

export type CreateUserInput = {
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

export type UpdateUserInput = Partial<CreateUserInput>

export function makeUserRepository(db: PrismaClient) {
  return {
    findFirst() {
      return db.user.findFirst()
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
