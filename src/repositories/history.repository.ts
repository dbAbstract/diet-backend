import { PrismaClient } from '../generated/prisma/client.js'

export function makeHistoryRepository(db: PrismaClient) {
  return {
    findLogsInRange(userId: string, from: Date, to: Date) {
      return db.dailyLog.findMany({
        where: { userId, date: { gte: from, lte: to } },
        include: { entries: true },
        orderBy: { date: 'asc' },
      })
    },

    findWeeksWithLogs(userId: string, page: number, pageSize: number) {
      return db.dailyLog.findMany({
        where: { userId },
        select: { date: true },
        orderBy: { date: 'desc' },
        skip: page * pageSize,
        take: pageSize,
      })
    },

    countLogsTotal(userId: string) {
      return db.dailyLog.count({ where: { userId } })
    },
  }
}

export type HistoryRepository = ReturnType<typeof makeHistoryRepository>
