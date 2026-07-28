import { FastifyPluginAsync } from 'fastify'
import { MealType } from '../../generated/prisma/client.js'
import { makeDailyLogRepository } from '../../repositories/daily-log.repository.js'
import { makeFoodItemRepository } from '../../repositories/food-item.repository.js'
import { makeRecipeRepository } from '../../repositories/recipe.repository.js'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeActivityRepository } from '../../repositories/activity.repository.js'
import { makeWeekSummaryRepository } from '../../repositories/week-summary.repository.js'
import { makeWeightRepository } from '../../repositories/weight.repository.js'
import { makeDailyLogService } from '../../services/daily-log.service.js'

const dateParam = {
  type: 'object',
  properties: { date: { type: 'string', format: 'date', description: 'ISO date e.g. 2026-04-06' } },
  required: ['date'],
}

const logs: FastifyPluginAsync = async (fastify) => {
  const logRepo = makeDailyLogRepository(fastify.db)
  const foodRepo = makeFoodItemRepository(fastify.db)
  const recipeRepo = makeRecipeRepository(fastify.db)
  const userRepo = makeUserRepository(fastify.db)
  const activityRepo = makeActivityRepository(fastify.db)
  const weekSummaryRepo = makeWeekSummaryRepository(fastify.db)
  const weightRepo = makeWeightRepository(fastify.db)

  function makeService(firebaseUid: string) {
    return makeDailyLogService(logRepo, foodRepo, recipeRepo, userRepo, activityRepo, weekSummaryRepo, weightRepo, firebaseUid)
  }

  // GET /logs/recent?limit=20
  fastify.get('/recent', {
    schema: {
      tags: ['Logs'],
      summary: 'Recently consumed meals — food items and recipes unified, sorted by last logged',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
        },
      },
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['food_item', 'recipe'] },
              lastLoggedAt: { type: 'string', format: 'date-time' },
              foodItem: { $ref: 'FoodItem#' },
              recipe: { $ref: 'Recipe#' },
            },
            required: ['type', 'lastLoggedAt'],
          },
        },
      },
    },
  }, async (request) => {
    const { limit = 20 } = request.query as { limit?: number }
    return makeService(request.firebaseUid).getRecentMeals(limit)
  })

  // GET /logs/:date
  fastify.get('/:date', {
    schema: {
      tags: ['Logs'],
      summary: 'Get the daily log for a date — creates one if it does not exist',
      params: dateParam,
      response: {
        200: { $ref: 'DailyLog#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { date } = request.params as { date: string }
    try {
      return await makeService(request.firebaseUid).getDailyLog(date)
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })

  // GET /logs/:date/summary
  fastify.get('/:date/summary', {
    schema: {
      tags: ['Logs'],
      summary: 'Get daily macro totals vs targets',
      params: dateParam,
      response: {
        200: { $ref: 'DailySummary#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { date } = request.params as { date: string }
    try {
      return await makeService(request.firebaseUid).getDailySummary(date)
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })

  // POST /logs/:date/entries
  fastify.post('/:date/entries', {
    schema: {
      tags: ['Logs'],
      summary: 'Log a meal entry for a date',
      description: 'Provide either foodItemId or recipeId, not both.',
      params: dateParam,
      body: {
        type: 'object',
        required: ['mealType', 'quantity'],
        properties: {
          mealType: { type: 'string', enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] },
          quantity: { type: 'number', description: 'Number of servings' },
          notes: { type: 'string' },
          foodItemId: { type: 'string' },
          recipeId: { type: 'string' },
        },
      },
      response: {
        201: { $ref: 'MealEntry#' },
        400: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { date } = request.params as { date: string }
    const body = request.body as {
      mealType: MealType
      quantity: number
      notes?: string
      foodItemId?: string
      recipeId?: string
    }
    try {
      const entry = await makeService(request.firebaseUid).logMeal(date, body)
      return reply.status(201).send(entry)
    } catch (e: any) {
      if (e.message === 'FOOD_NOT_FOUND' || e.message === 'RECIPE_NOT_FOUND') {
        return reply.status(404).send({ error: e.message })
      }
      if (e.message === 'MISSING_FOOD_SOURCE' || e.message === 'AMBIGUOUS_FOOD_SOURCE') {
        return reply.status(400).send({ error: e.message })
      }
      throw e
    }
  })

  // PATCH /logs/:date/entries/:entryId
  fastify.patch('/:date/entries/:entryId', {
    schema: {
      tags: ['Logs'],
      summary: 'Update a meal entry',
      params: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          entryId: { type: 'string' },
        },
        required: ['date', 'entryId'],
      },
      body: {
        type: 'object',
        properties: {
          mealType: { type: 'string', enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] },
          quantity: { type: 'number' },
          notes: { type: 'string' },
        },
      },
      response: {
        200: { $ref: 'MealEntry#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { entryId } = request.params as { date: string; entryId: string }
    const body = request.body as {
      mealType?: MealType
      quantity?: number
      notes?: string
    }
    try {
      return await makeService(request.firebaseUid).updateMealEntry(entryId, body)
    } catch {
      return reply.status(404).send({ error: 'Entry not found' })
    }
  })

  // DELETE /logs/:date/entries/:entryId
  fastify.delete('/:date/entries/:entryId', {
    schema: {
      tags: ['Logs'],
      summary: 'Delete a meal entry',
      params: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date' },
          entryId: { type: 'string' },
        },
        required: ['date', 'entryId'],
      },
      response: {
        204: { type: 'null', description: 'Deleted successfully' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { entryId } = request.params as { date: string; entryId: string }
    try {
      await makeService(request.firebaseUid).deleteMealEntry(entryId)
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ error: 'Entry not found' })
    }
  })
}

export default logs
