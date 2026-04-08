import { PrismaClient, ActivitySource } from '../generated/prisma/client.js'

export type CreateActivityEntryInput = {
  userId: string
  date: Date
  description: string
  kcalBurned: number
  source: ActivitySource
}

export function makeActivityRepository(db: PrismaClient) {
  return {
    findAll(userId: string) {
      return db.activityEntry.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
      })
    },

    findInRange(userId: string, from: Date, to: Date) {
      return db.activityEntry.findMany({
        where: { userId, date: { gte: from, lte: to } },
        orderBy: { date: 'asc' },
      })
    },

    findByDate(userId: string, date: Date) {
      return db.activityEntry.findMany({
        where: { userId, date },
        orderBy: { createdAt: 'asc' },
      })
    },

    create(data: CreateActivityEntryInput) {
      return db.activityEntry.create({ data })
    },

    delete(id: string) {
      return db.activityEntry.delete({ where: { id } })
    },
  }
}

export type ActivityRepository = ReturnType<typeof makeActivityRepository>
