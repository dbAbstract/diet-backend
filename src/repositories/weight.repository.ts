import { PrismaClient } from '../generated/prisma/client.js'

export type CreateWeightEntryInput = {
  userId: string
  date: Date
  weight: number
}

export function makeWeightRepository(db: PrismaClient) {
  return {
    findAll(userId: string) {
      return db.weightEntry.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      })
    },

    create(data: CreateWeightEntryInput) {
      return db.weightEntry.create({ data })
    },

    delete(id: string) {
      return db.weightEntry.delete({ where: { id } })
    },
  }
}

export type WeightRepository = ReturnType<typeof makeWeightRepository>
