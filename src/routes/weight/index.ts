import { FastifyPluginAsync } from 'fastify'
import { makeWeightRepository } from '../../repositories/weight.repository.js'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeWeightService } from '../../services/weight.service.js'

const weight: FastifyPluginAsync = async (fastify) => {
  const service = makeWeightService(
    makeWeightRepository(fastify.db),
    makeUserRepository(fastify.db)
  )

  // GET /weight
  fastify.get('/', {
    schema: {
      tags: ['Weight'],
      summary: 'List all weight entries',
      response: {
        200: { type: 'array', items: { $ref: 'WeightEntry#' } },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    try {
      return await service.listWeightEntries()
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })

  // POST /weight
  fastify.post('/', {
    schema: {
      tags: ['Weight'],
      summary: 'Log a weight entry',
      body: {
        type: 'object',
        required: ['weight'],
        properties: {
          weight: { type: 'number', description: 'Weight in kg' },
          bodyFatPct: { type: 'number', description: 'Body fat percentage — optional, log when available' },
          date: { type: 'string', format: 'date', description: 'ISO date — defaults to today if omitted' },
        },
      },
      response: {
        201: { $ref: 'WeightEntry#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { weight: number; bodyFatPct?: number; date?: string }
    try {
      const entry = await service.logWeight(
        body.weight,
        body.bodyFatPct,
        body.date ? new Date(body.date) : undefined
      )
      return reply.status(201).send(entry)
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })

  // DELETE /weight/:id
  fastify.delete('/:id', {
    schema: {
      tags: ['Weight'],
      summary: 'Delete a weight entry',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        204: { type: 'null', description: 'Deleted successfully' },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.deleteWeightEntry(id)
    return reply.status(204).send()
  })
}

export default weight
