import fp from 'fastify-plugin'
import Anthropic from '@anthropic-ai/sdk'

export default fp(async (fastify) => {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set')

  const client = new Anthropic({ apiKey })
  fastify.decorate('ai', client)
})

declare module 'fastify' {
  export interface FastifyInstance {
    ai: Anthropic
  }
}
