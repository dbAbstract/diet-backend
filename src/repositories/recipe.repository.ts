import { PrismaClient } from '../generated/prisma/client.js'

export type RecipeIngredientInput = {
  foodItemId: string
  quantity: number
}

export type CreateRecipeInput = {
  name: string
  ingredients: RecipeIngredientInput[]
}

export function makeRecipeRepository(db: PrismaClient) {
  return {
    findAll() {
      return db.recipe.findMany({
        include: { ingredients: { include: { foodItem: true } } },
        orderBy: { name: 'asc' },
      })
    },

    findById(id: string) {
      return db.recipe.findUnique({
        where: { id },
        include: { ingredients: { include: { foodItem: true } } },
      })
    },

    create(data: CreateRecipeInput) {
      return db.recipe.create({
        data: {
          name: data.name,
          ingredients: {
            create: data.ingredients.map((i) => ({
              foodItemId: i.foodItemId,
              quantity: i.quantity,
            })),
          },
        },
        include: { ingredients: { include: { foodItem: true } } },
      })
    },

    async update(id: string, data: Partial<CreateRecipeInput>) {
      return db.$transaction(async (tx) => {
        if (data.ingredients) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
          await tx.recipeIngredient.createMany({
            data: data.ingredients.map((i) => ({
              recipeId: id,
              foodItemId: i.foodItemId,
              quantity: i.quantity,
            })),
          })
        }
        return tx.recipe.update({
          where: { id },
          data: { name: data.name },
          include: { ingredients: { include: { foodItem: true } } },
        })
      })
    },

    delete(id: string) {
      return db.recipe.delete({ where: { id } })
    },
  }
}

export type RecipeRepository = ReturnType<typeof makeRecipeRepository>
