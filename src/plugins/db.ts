import fp from 'fastify-plugin'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '../generated/prisma/client.js'

export default fp(async (fastify) => {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  await prisma.$connect()

  // Disconnect cleanly when the server shuts down
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })

  fastify.decorate('db', prisma)
})

// Extend FastifyInstance so every route gets full type support on fastify.db
declare module 'fastify' {
  export interface FastifyInstance {
    db: PrismaClient
  }
}
