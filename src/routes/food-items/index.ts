import { FastifyPluginAsync } from 'fastify'
import { FoodSource } from '../../generated/prisma/client.js'
import { makeFoodItemRepository } from '../../repositories/food-item.repository.js'
import { makeFoodItemService } from '../../services/food-item.service.js'

const foodItems: FastifyPluginAsync = async (fastify) => {
  const repo = makeFoodItemRepository(fastify.db)
  const service = makeFoodItemService(repo)

  // GET /food-items?search=xxx
  fastify.get('/', async (request, reply) => {
    const { search } = request.query as { search?: string }
    return service.listFoodItems(search)
  })

  // GET /food-items/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      return await service.getFoodItem(id)
    } catch {
      return reply.status(404).send({ error: 'Food item not found' })
    }
  })

  // POST /food-items
  fastify.post('/', async (request, reply) => {
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
  fastify.patch('/:id', async (request, reply) => {
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
  fastify.delete('/:id', async (request, reply) => {
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
