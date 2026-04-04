import fp from 'fastify-plugin'

export default fp(async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const apiKey = process.env.API_KEY

    if (!apiKey) {
      throw new Error('API_KEY environment variable is not set')
    }

    const authHeader = request.headers['authorization']
    if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }
  })
})
