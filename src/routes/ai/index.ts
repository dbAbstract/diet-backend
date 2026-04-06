import { FastifyPluginAsync } from 'fastify'
import { makeMealParserService, ChatMessage } from '../../services/meal-parser.service.js'

const ai: FastifyPluginAsync = async (fastify) => {
  const service = makeMealParserService(fastify.ai)

  // POST /ai/parse-meal
  // Accepts a conversation history and returns either parsed food data or a clarifying question
  fastify.post('/parse-meal', async (request, reply) => {
    const body = request.body as { messages: ChatMessage[] }

    if (!body.messages || body.messages.length === 0) {
      return reply.status(400).send({ error: 'messages array is required' })
    }

    const result = await service.parseMessage(body.messages)
    return reply.send(result)
  })
}

export default ai
