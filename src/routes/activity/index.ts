import { FastifyPluginAsync } from 'fastify'
import { ActivitySource } from '../../generated/prisma/client.js'
import { makeActivityRepository } from '../../repositories/activity.repository.js'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeWeightRepository } from '../../repositories/weight.repository.js'
import { makeActivityService } from '../../services/activity.service.js'

const activity: FastifyPluginAsync = async (fastify) => {
  const activityRepo = makeActivityRepository(fastify.db)
  const userRepo = makeUserRepository(fastify.db)
  const weightRepo = makeWeightRepository(fastify.db)

  // GET /activity?from=&to=
  fastify.get('/', {
    schema: {
      tags: ['Activity'],
      summary: 'List activity entries',
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', format: 'date', description: 'Start date (inclusive)' },
          to: { type: 'string', format: 'date', description: 'End date (inclusive)' },
        },
      },
      response: {
        200: { type: 'array', items: { $ref: 'ActivityEntry#' } },
        400: { $ref: 'ErrorResponse#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { from, to } = request.query as { from?: string; to?: string }
    if ((from && !to) || (!from && to)) {
      return reply.status(400).send({ error: 'Provide both from and to, or neither' })
    }
    const service = makeActivityService(activityRepo, userRepo, weightRepo, request.firebaseUid)
    try {
      return await service.listActivityEntries(
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
      )
    } catch (e: any) {
      if (e.message === 'USER_NOT_FOUND') return reply.status(404).send({ error: 'User not found' })
      throw e
    }
  })

  // POST /activity
  fastify.post('/', {
    schema: {
      tags: ['Activity'],
      summary: 'Log an activity entry manually',
      body: {
        type: 'object',
        required: ['description', 'kcalBurned'],
        properties: {
          description: { type: 'string' },
          kcalBurned: { type: 'number' },
          date: { type: 'string', format: 'date', description: 'ISO date — defaults to today' },
          source: { type: 'string', enum: ['AI_ESTIMATED', 'WHOOP', 'MANUAL'], default: 'MANUAL' },
        },
      },
      response: {
        201: { $ref: 'ActivityEntry#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      description: string
      kcalBurned: number
      date?: string
      source?: ActivitySource
    }
    const service = makeActivityService(activityRepo, userRepo, weightRepo, request.firebaseUid)
    try {
      const entry = await service.logActivity({
        ...body,
        date: body.date ? new Date(body.date) : undefined,
      })
      return reply.status(201).send(entry)
    } catch (e: any) {
      if (e.message === 'USER_NOT_FOUND') return reply.status(404).send({ error: 'User not found' })
      throw e
    }
  })

  // DELETE /activity/:id
  fastify.delete('/:id', {
    schema: {
      tags: ['Activity'],
      summary: 'Delete an activity entry',
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
    const service = makeActivityService(activityRepo, userRepo, weightRepo, request.firebaseUid)
    await service.deleteActivityEntry(id)
    return reply.status(204).send()
  })
}

export default activity
