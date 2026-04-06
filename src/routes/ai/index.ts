import { FastifyPluginAsync } from 'fastify'
import { makeMealParserService, ChatMessage } from '../../services/meal-parser.service.js'

const ai: FastifyPluginAsync = async (fastify) => {
  const service = makeMealParserService(fastify.ai)

  // POST /ai/parse-meal
  fastify.post('/parse-meal', {
    schema: {
      tags: ['AI'],
      summary: 'Parse a natural language meal description',
      description: 'Send a conversation history. Returns either parsed macro data or a clarifying question. The client is responsible for maintaining message history across turns.',
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['role', 'content'],
              properties: {
                role: { type: 'string', enum: ['user', 'assistant'] },
                content: { type: 'string' },
              },
            },
          },
        },
      },
      response: {
        200: {
          oneOf: [
            {
              type: 'object',
              description: 'Macro data successfully parsed',
              properties: {
                type: { type: 'string', enum: ['parsed'] },
                food: { $ref: 'ParsedFood#' },
              },
            },
            {
              type: 'object',
              description: 'More information needed',
              properties: {
                type: { type: 'string', enum: ['clarification'] },
                question: { type: 'string' },
              },
            },
          ],
        },
        400: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { messages: ChatMessage[] }

    if (!body.messages || body.messages.length === 0) {
      return reply.status(400).send({ error: 'messages array is required' })
    }

    const result = await service.parseMessage(body.messages)
    return reply.send(result)
  })
}

export default ai
