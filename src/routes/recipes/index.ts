import { FastifyPluginAsync } from 'fastify'
import { makeRecipeRepository } from '../../repositories/recipe.repository.js'
import { makeRecipeService } from '../../services/recipe.service.js'

const ingredientSchema = {
  type: 'object',
  required: ['foodItemId', 'quantity'],
  properties: {
    foodItemId: { type: 'string' },
    quantity: { type: 'number', description: 'Number of servings of this food item' },
  },
}

const recipes: FastifyPluginAsync = async (fastify) => {
  const service = makeRecipeService(makeRecipeRepository(fastify.db))

  // GET /recipes
  fastify.get('/', {
    schema: {
      tags: ['Recipes'],
      summary: 'List all recipes with computed macros',
      response: {
        200: { type: 'array', items: { $ref: 'Recipe#' } },
      },
    },
  }, async () => {
    return service.listRecipes()
  })

  // GET /recipes/:id
  fastify.get('/:id', {
    schema: {
      tags: ['Recipes'],
      summary: 'Get a recipe by ID with computed macros',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: { $ref: 'Recipe#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      return await service.getRecipe(id)
    } catch {
      return reply.status(404).send({ error: 'Recipe not found' })
    }
  })

  // POST /recipes
  fastify.post('/', {
    schema: {
      tags: ['Recipes'],
      summary: 'Create a recipe',
      body: {
        type: 'object',
        required: ['name', 'ingredients'],
        properties: {
          name: { type: 'string' },
          ingredients: { type: 'array', items: ingredientSchema, minItems: 1 },
        },
      },
      response: {
        201: { $ref: 'Recipe#' },
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      name: string
      ingredients: { foodItemId: string; quantity: number }[]
    }
    const recipe = await service.createRecipe(body)
    return reply.status(201).send(recipe)
  })

  // PATCH /recipes/:id
  fastify.patch('/:id', {
    schema: {
      tags: ['Recipes'],
      summary: 'Update a recipe name or replace all ingredients',
      description: 'Sending ingredients replaces the entire ingredient list.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          ingredients: { type: 'array', items: ingredientSchema, minItems: 1 },
        },
      },
      response: {
        200: { $ref: 'Recipe#' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
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
  fastify.delete('/:id', {
    schema: {
      tags: ['Recipes'],
      summary: 'Delete a recipe',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        204: { type: 'null', description: 'Deleted successfully' },
        404: { $ref: 'ErrorResponse#' },
      },
    },
  }, async (request, reply) => {
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
