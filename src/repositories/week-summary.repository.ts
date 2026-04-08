import { PrismaClient, WeekStatus } from '../generated/prisma/client.js'

export function makeWeekSummaryRepository(db: PrismaClient) {
  return {
    findByWeekStart(userId: string, weekStart: Date) {
      return db.weekSummary.findUnique({
        where: { userId_weekStart: { userId, weekStart } },
      })
    },

    findLatestFinalized(userId: string) {
      return db.weekSummary.findFirst({
        where: { userId, status: WeekStatus.FINALIZED },
        orderBy: { weekStart: 'desc' },
      })
    },

    findPendingReview(userId: string) {
      return db.weekSummary.findFirst({
        where: { userId, status: WeekStatus.PENDING_REVIEW },
        orderBy: { weekStart: 'desc' },
      })
    },

    create(data: { userId: string; weekStart: Date; calorieTarget: number }) {
      return db.weekSummary.create({ data })
    },

    update(id: string, data: Parameters<typeof db.weekSummary.update>[0]['data']) {
      return db.weekSummary.update({ where: { id }, data })
    },
  }
}

export type WeekSummaryRepository = ReturnType<typeof makeWeekSummaryRepository>
