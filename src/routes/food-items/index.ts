import { FastifyPluginAsync } from 'fastify'
import { FoodSource } from '../../generated/prisma/client.js'
import { makeFoodItemRepository } from '../../repositories/food-item.repository.js'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeFoodItemService } from '../../services/food-item.service.js'

const foodItems: FastifyPluginAsync = async (fastify) => {
  const repo = makeFoodItemRepository(fastify.db)
  const service = makeFoodItemService(repo, makeUserRepository(fastify.db))

  // GET /food-items?search=xxx
  fastify.get('/', {
    schema: {
      tags: ['Food Items'],
      summary: 'List all food items',
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Filter by name (case-insensitive)' },
        },
      },
      response: {
        200: { type: 'array', items: { $ref: 'FoodItem#' } },
      },
    },
  }, async (request) => {
    const { search } = request.query as { search?: string }
    return service.listFoodItems(search)
  })

  // GET /food-items/recent?limit=10
  fastify.get('/recent', {
    schema: {
      tags: ['Food Items'],
      summary: 'List recently logged food items',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 10, description: 'Max number of items to return' },
        },
      },
      response: {
        200: { type: 'array', items: { $ref: 'FoodItem#' } },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { limit = 10 } = request.query as { limit?: number }
    try {
      return await service.listRecentFoodItems(limit)
    } catch (e: any) {
      if (e.message === 'USER_NOT_FOUND') return reply.status(404).send({ error: 'User not found' })
      throw e
    }
  })

  // GET /food-items/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Food Items'],
      summary: 'Get a food item by ID',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: { $ref: 'FoodItem#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      return await service.getFoodItem(id)
    } catch {
      return reply.status(404).send({ error: 'Food item not found' })
    }
  })

  // POST /food-items
  fastify.post('/', {
    schema: {
      tags: ['Food Items'],
      summary: 'Create a food item',
      body: {
        type: 'object',
        required: ['name', 'servingSize', 'servingLabel', 'kcal', 'protein', 'carbs', 'fat', 'fiber'],
        properties: {
          name: { type: 'string' },
          servingSize: { type: 'number', description: 'In grams or ml' },
          servingLabel: { type: 'string', examples: ['100g', '1 cup', '1 scoop'] },
          source: { type: 'string', enum: ['CUSTOM', 'AI_GENERATED'], default: 'CUSTOM' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          fiber: { type: 'number' },
        },
      },
      response: {
        201: { $ref: 'FoodItem#' },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name: string
      servingSize: number
      servingLabel: string
      source?: FoodSource
      kcal: number
      protein: number
      carbs: number
      fat: number
      fiber: number
    }
    const item = await service.createFoodItem({
      ...body,
      source: body.source ?? FoodSource.CUSTOM,
    })
    return reply.status(201).send(item)
  })

  // PATCH /food-items/:id
  fastify.patch('/:id', {
    schema: {
      tags: ['Food Items'],
      summary: 'Update a food item',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          servingSize: { type: 'number' },
          servingLabel: { type: 'string' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          fiber: { type: 'number' },
        },
      },
      response: {
        200: { $ref: 'FoodItem#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      servingSize?: number
      servingLabel?: string
      kcal?: number
      protein?: number
      carbs?: number
      fat?: number
      fiber?: number
    }
    try {
      return await service.updateFoodItem(id, body)
    } catch {
      return reply.status(404).send({ error: 'Food item not found' })
    }
  })

  // DELETE /food-items/:id
  fastify.delete('/:id', {
    schema: {
      tags: ['Food Items'],
      summary: 'Delete a food item',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        204: { type: 'null', description: 'Deleted successfully' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await service.deleteFoodItem(id)
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ error: 'Food item not found' })
    }
  })
}

export default foodItems
