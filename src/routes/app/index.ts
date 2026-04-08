import { FastifyPluginAsync } from 'fastify'
import { makeWeekSummaryRepository } from '../../repositories/week-summary.repository.js'
import { makeHistoryRepository } from '../../repositories/history.repository.js'
import { makeWeightRepository } from '../../repositories/weight.repository.js'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeWeekSummaryService } from '../../services/week-summary.service.js'

const app: FastifyPluginAsync = async (fastify) => {
  const service = makeWeekSummaryService(
    makeWeekSummaryRepository(fastify.db),
    makeHistoryRepository(fastify.db),
    makeWeightRepository(fastify.db),
    makeUserRepository(fastify.db),
    fastify.ai
  )

  // GET /app/state — called on every app open
  fastify.get('/state', {
    schema: {
      tags: ['App'],
      summary: 'App launch state — current week target and any pending week review',
      response: {
        200: {
          type: 'object',
          properties: {
            currentWeek: {
              type: 'object',
              properties: {
                weekStart: { type: 'string', format: 'date' },
                calorieTarget: { type: 'integer', description: 'Active kcal target for this week' },
              },
              required: ['weekStart', 'calorieTarget'],
            },
            pendingReview: {
              oneOf: [
                {
                  type: 'object',
                  properties: {
                    weekStart: { type: 'string', format: 'date' },
                    daysLogged: { type: 'integer' },
                    avgKcal: { type: 'integer', nullable: true },
                    avgWeight: { type: 'number', nullable: true },
                  },
                  required: ['weekStart', 'daysLogged'],
                },
                { type: 'null' },
              ],
            },
          },
          required: ['currentWeek', 'pendingReview'],
        },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    try {
      return await service.getAppState()
    } catch (e: any) {
      if (e.message === 'USER_NOT_FOUND') {
        return reply.status(404).send({ error: 'User not found' })
      }
      throw e
    }
  })
}

export default app
