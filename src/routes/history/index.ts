import { FastifyPluginAsync } from 'fastify'
import { makeHistoryRepository } from '../../repositories/history.repository.js'
import { makeWeightRepository } from '../../repositories/weight.repository.js'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeHistoryService } from '../../services/history.service.js'

const history: FastifyPluginAsync = async (fastify) => {
  const service = makeHistoryService(
    makeHistoryRepository(fastify.db),
    makeWeightRepository(fastify.db),
    makeUserRepository(fastify.db)
  )

  // GET /history/weeks?page=0&pageSize=10
  fastify.get('/weeks', {
    schema: {
      tags: ['History'],
      summary: 'List weeks that have logged data, paginated',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 0, description: 'Zero-based page index' },
          pageSize: { type: 'integer', default: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
            total: { type: 'integer', description: 'Approximate total number of weeks' },
            weeks: {
              type: 'array',
              items: { type: 'string', format: 'date', description: 'Monday date of each week' },
            },
          },
        },
      },
    },
  }, async (request) => {
    const { page = 0, pageSize = 10 } = request.query as { page?: number; pageSize?: number }
    return service.listWeeks(page, pageSize)
  })

  // GET /history/weeks/:weekStart  (e.g. /history/weeks/2026-04-06)
  fastify.get('/weeks/:weekStart', {
    schema: {
      tags: ['History'],
      summary: 'Get detailed summary for a week — must be a Monday date',
      params: {
        type: 'object',
        properties: {
          weekStart: { type: 'string', format: 'date', description: 'Monday date e.g. 2026-04-06' },
        },
        required: ['weekStart'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            weekStart: { type: 'string' },
            weekEnd: { type: 'string' },
            dailyCalorieTarget: { type: 'number', description: 'TDEE minus daily deficit, based on latest weight' },
            days: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  kcal: { type: 'number', nullable: true },
                  protein: { type: 'number', nullable: true },
                  carbs: { type: 'number', nullable: true },
                  fat: { type: 'number', nullable: true },
                  weight: { type: 'number', nullable: true },
                  bodyFatPct: { type: 'number', nullable: true },
                },
              },
            },
            summary: {
              type: 'object',
              properties: {
                avgKcal: { type: 'number', nullable: true },
                avgWeight: { type: 'number', nullable: true },
                weightChange: { type: 'number', nullable: true, description: 'vs previous week average (kg)' },
                daysLogged: { type: 'integer' },
                adherentDays: { type: 'integer', description: 'Days at or under calorie target' },
                adherencePct: { type: 'number', nullable: true },
              },
            },
          },
        },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { weekStart } = request.params as { weekStart: string }
    try {
      return await service.getWeekSummary(weekStart)
    } catch (e: any) {
      if (e.message === 'USER_NOT_FOUND') {
        return reply.status(404).send({ error: 'User not found' })
      }
      throw e
    }
  })
}

export default history
