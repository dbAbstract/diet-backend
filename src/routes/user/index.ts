import { FastifyPluginAsync } from 'fastify'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeUserService } from '../../services/user.service.js'

const user: FastifyPluginAsync = async (fastify) => {
  const repo = makeUserRepository(fastify.db)
  const service = makeUserService(repo)

  // GET /user
  fastify.get('/', async (request, reply) => {
    try {
      return await service.getUser()
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })

  // POST /user
  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      name: string
      height: number
      dateOfBirth: string
      targetCalories: number
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
  fastify.patch('/', async (request, reply) => {
    const body = request.body as {
      name?: string
      height?: number
      dateOfBirth?: string
      targetCalories?: number
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
