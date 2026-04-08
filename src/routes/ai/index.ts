import { FastifyPluginAsync } from 'fastify'
import { makeMealParserService, ChatMessage } from '../../services/meal-parser.service.js'
import { makeActivityParserService } from '../../services/activity-parser.service.js'
import { makeActivityService } from '../../services/activity.service.js'
import { makeActivityRepository } from '../../repositories/activity.repository.js'
import { makeUserRepository } from '../../repositories/user.repository.js'
import { makeWeightRepository } from '../../repositories/weight.repository.js'

const ai: FastifyPluginAsync = async (fastify) => {
  const service = makeMealParserService(fastify.ai)
  const activityParser = makeActivityParserService(fastify.ai)
  const activityService = makeActivityService(
    makeActivityRepository(fastify.db),
    makeUserRepository(fastify.db),
    makeWeightRepository(fastify.db),
  )

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

  // POST /ai/parse-activity
  fastify.post('/parse-activity', {
    schema: {
      tags: ['AI'],
      summary: 'Parse a natural language activity description',
      description: 'Send a conversation history. Returns either estimated kcal burned or a clarifying question. The client is responsible for maintaining message history across turns.',
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
              description: 'Activity successfully parsed',
              properties: {
                type: { type: 'string', enum: ['parsed'] },
                activity: { $ref: 'ParsedActivity#' },
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
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { messages: ChatMessage[] }

    if (!body.messages || body.messages.length === 0) {
      return reply.status(400).send({ error: 'messages array is required' })
    }

    try {
      const weightKg = await activityService.getLatestWeightKg()
      const result = await activityParser.parseMessage(body.messages, weightKg)
      return reply.send(result)
    } catch (e: any) {
      if (e.message === 'USER_NOT_FOUND') return reply.status(404).send({ error: 'User not found' })
      throw e
    }
  })
}

export default ai
