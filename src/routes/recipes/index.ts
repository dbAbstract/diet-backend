import { FastifyPluginAsync } from 'fastify'
import { makeRecipeRepository } from '../../repositories/recipe.repository.js'
import { makeRecipeService } from '../../services/recipe.service.js'

const recipes: FastifyPluginAsync = async (fastify) => {
  const service = makeRecipeService(makeRecipeRepository(fastify.db))

  // GET /recipes
  fastify.get('/', async () => {
    return service.listRecipes()
  })

  // GET /recipes/:id
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      return await service.getRecipe(id)
    } catch {
      return reply.status(404).send({ error: 'Recipe not found' })
    }
  })

  // POST /recipes
  fastify.post('/', async (request, reply) => {
    const body = request.body as {
      name: string
      ingredients: { foodItemId: string; quantity: number }[]
    }
    const recipe = await service.createRecipe(body)
    return reply.status(201).send(recipe)
  })

  // PATCH /recipes/:id
  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      name?: string
      ingredients?: { foodItemId: string; quantity: number }[]
    }
    try {
      return await service.updateRecipe(id, body)
    } catch {
      return reply.status(404).send({ error: 'Recipe not found' })
    }
  })

  // DELETE /recipes/:id
  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      await service.deleteRecipe(id)
      return reply.status(204).send()
    } catch {
      return reply.status(404).send({ error: 'Recipe not found' })
    }
  })
}

export default recipes
