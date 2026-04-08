import fp from 'fastify-plugin'
import admin from 'firebase-admin'

declare module 'fastify' {
  interface FastifyRequest {
    firebaseUid: string
  }
}

export default fp(async (fastify) => {
  fastify.decorateRequest('firebaseUid', '')

  fastify.addHook('onRequest', async (request, reply) => {
    const url = request.url
    if (url.startsWith('/docs') || url.startsWith('/documentation')) return

    const authHeader = request.headers['authorization']
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' })
    }

    const token = authHeader.slice(7)
    try {
      const decoded = await admin.auth().verifyIdToken(token)
      request.firebaseUid = decoded.uid
    } catch {
      return reply.status(401).send({ error: 'Invalid or expired token' })
    }
  })
})
