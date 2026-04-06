import fp from 'fastify-plugin'
import swagger from '@fastify/swagger'
import scalarReference from '@scalar/fastify-api-reference'

export default fp(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Diet API',
        description: 'Backend API for the Diet personal tracking app',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description: 'API key — set in .env as API_KEY',
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  })

  await fastify.register(scalarReference, {
    routePrefix: '/docs',
  })
})
