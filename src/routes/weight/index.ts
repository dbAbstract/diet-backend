import { FastifyPluginAsync } from 'fastify'
import { makeWeightRepository } from '../../repositories/weight.repository.js'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeWeightService } from '../../services/weight.service.js'

const weight: FastifyPluginAsync = async (fastify) => {
  const service = makeWeightService(
    makeWeightRepository(fastify.db),
    makeUserRepository(fastify.db)
  )

  // GET /weight?from=2026-01-01&to=2026-04-08
  fastify.get('/', {
    schema: {
      tags: ['Weight'],
      summary: 'List weight entries',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', format: 'date', description: 'Start date (inclusive) — ISO date e.g. 2026-01-01' },
          to: { type: 'string', format: 'date', description: 'End date (inclusive) — ISO date e.g. 2026-04-08' },
        },
      },
      response: {
        200: { type: 'array', items: { $ref: 'WeightEntry#' } },
        400: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string }
    if ((from && !to) || (!from && to)) {
      return reply.status(400).send({ error: 'Provide both from and to, or neither' })
    }
    try {
      return await service.listWeightEntries(
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
      )
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
