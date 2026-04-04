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
  fastify.get('/', async (request, reply) => {
    try {
      return await service.listWeightEntries()
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })

  // POST /weight
  fastify.post('/', async (request, reply) => {
    const body = request.body as { weight: number; date?: string }
    try {
      const entry = await service.logWeight(
        body.weight,
        body.date ? new Date(body.date) : undefined
      )
      return reply.status(201).send(entry)
    } catch {
      return reply.status(404).send({ error: 'User not found' })
    }
  })

  // DELETE /weight/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    await service.deleteWeightEntry(id)
    return reply.status(204).send()
  })
}

export default weight
