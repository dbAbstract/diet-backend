import { FastifyPluginAsync } from 'fastify'
import { Sex } from '../../generated/prisma/client.js'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeUserService } from '../../services/user.service.js'

const user: FastifyPluginAsync = async (fastify) => {
  const repo = makeUserRepository(fastify.db)
  const service = makeUserService(repo)

  // GET /user
  fastify.get('/', {
    schema: {
      tags: ['User'],
      summary: 'Get the current user profile and goals',
      response: {
        200: { $ref: 'User#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    try {
      return await service.getUser()
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })

  // POST /user
  fastify.post('/', {
    schema: {
      tags: ['User'],
      summary: 'Create the user profile (run once on setup)',
      body: {
        type: 'object',
        required: ['name', 'sex', 'height', 'dateOfBirth', 'targetWeightKg', 'dailyDeficitKcal', 'targetProtein', 'targetCarbs', 'targetFat'],
        properties: {
          name: { type: 'string' },
          sex: { type: 'string', enum: ['MALE', 'FEMALE'] },
          height: { type: 'number', description: 'Height in cm' },
          dateOfBirth: { type: 'string', format: 'date', description: 'ISO date e.g. 1990-01-01' },
          targetWeightKg: { type: 'number', description: 'Goal weight in kg' },
          dailyDeficitKcal: { type: 'number', description: 'Daily calorie deficit target (e.g. 400)' },
          targetProtein: { type: 'number', description: 'In grams' },
          targetCarbs: { type: 'number', description: 'In grams' },
          targetFat: { type: 'number', description: 'In grams' },
        },
      },
      response: {
        201: { $ref: 'User#' },
        409: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name: string
      sex: Sex
      height: number
      dateOfBirth: string
      targetWeightKg: number
      dailyDeficitKcal: number
      targetProtein: number
      targetCarbs: number
      targetFat: number
    }
    try {
      const created = await service.createUser({
        ...body,
        dateOfBirth: new Date(body.dateOfBirth),
      })
      return reply.status(201).send(created)
    } catch (e: any) {
      if (e.message === 'USER_EXISTS') {
        return reply.status(409).send({ error: 'User already exists' })
      }
      throw e
    }
  })

  // PATCH /user
  fastify.patch('/', {
    schema: {
      tags: ['User'],
      summary: 'Update user profile or goals',
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          sex: { type: 'string', enum: ['MALE', 'FEMALE'] },
          height: { type: 'number' },
          dateOfBirth: { type: 'string', format: 'date' },
          targetWeightKg: { type: 'number' },
          dailyDeficitKcal: { type: 'number' },
          targetProtein: { type: 'number' },
          targetCarbs: { type: 'number' },
          targetFat: { type: 'number' },
        },
      },
      response: {
        200: { $ref: 'User#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name?: string
      sex?: Sex
      height?: number
      dateOfBirth?: string
      targetWeightKg?: number
      dailyDeficitKcal?: number
      targetProtein?: number
      targetCarbs?: number
      targetFat?: number
    }
    try {
      return await service.updateUser({
        ...body,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : undefined,
      })
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })
}

export default user
