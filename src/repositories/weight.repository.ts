import { PrismaClient } from '../generated/prisma/client.js'

export type CreateWeightEntryInput = {
  userId: string
  date: Date
  weight: number
  bodyFatPct?: number
}

export function makeWeightRepository(db: PrismaClient) {
  return {
    findAll(userId: string) {
      return db.weightEntry.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      })
    },

    findInRange(userId: string, from: Date, to: Date) {
      return db.weightEntry.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
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
