import fp from 'fastify-plugin'

// Shared response schemas registered globally so routes can reference them with $ref

export default fp(async (fastify) => {
  fastify.addSchema({
    $id: 'Macros',
    type: 'object',
    properties: {
      kcal: { type: 'number' },
      protein: { type: 'number' },
      carbs: { type: 'number' },
      fat: { type: 'number' },
      fiber: { type: 'number' },
    },
  })

  fastify.addSchema({
    $id: 'FoodItem',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      servingSize: { type: 'number' },
      servingLabel: { type: 'string' },
      source: { type: 'string', enum: ['CUSTOM', 'AI_GENERATED'] },
      kcal: { type: 'number' },
      protein: { type: 'number' },
      carbs: { type: 'number' },
      fat: { type: 'number' },
      fiber: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  })

  fastify.addSchema({
    $id: 'RecipeIngredient',
    type: 'object',
    properties: {
      id: { type: 'string' },
      recipeId: { type: 'string' },
      foodItemId: { type: 'string' },
      quantity: { type: 'number' },
      foodItem: { $ref: 'FoodItem#' },
    },
  })

  fastify.addSchema({
    $id: 'Recipe',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      ingredients: { type: 'array', items: { $ref: 'RecipeIngredient#' } },
      macros: { $ref: 'Macros#' },
    },
  })

  fastify.addSchema({
    $id: 'MealEntry',
    type: 'object',
    properties: {
      id: { type: 'string' },
      dailyLogId: { type: 'string' },
      mealType: { type: 'string', enum: ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] },
      quantity: { type: 'number' },
      notes: { type: 'string', nullable: true },
      foodItemId: { type: 'string', nullable: true },
      recipeId: { type: 'string', nullable: true },
      kcal: { type: 'number' },
      protein: { type: 'number' },
      carbs: { type: 'number' },
      fat: { type: 'number' },
      fiber: { type: 'number' },
      loggedAt: { type: 'string', format: 'date-time' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  })

  fastify.addSchema({
    $id: 'DailyLog',
    type: 'object',
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      date: { type: 'string' },
      entries: { type: 'array', items: { $ref: 'MealEntry#' } },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  })

  fastify.addSchema({
    $id: 'DailySummary',
    type: 'object',
    properties: {
      date: { type: 'string' },
      totals: { $ref: 'Macros#' },
      targets: {
        type: 'object',
        properties: {
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
        },
      },
      entries: { type: 'array', items: { $ref: 'MealEntry#' } },
    },
  })

  fastify.addSchema({
    $id: 'User',
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
      sex: { type: 'string', enum: ['MALE', 'FEMALE'] },
      height: { type: 'number' },
      dateOfBirth: { type: 'string', format: 'date-time' },
      targetWeightKg: { type: 'number' },
      dailyDeficitKcal: { type: 'number' },
      targetProtein: { type: 'number' },
      targetCarbs: { type: 'number' },
      targetFat: { type: 'number' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  })

  fastify.addSchema({
    $id: 'WeightEntry',
    type: 'object',
    properties: {
      id: { type: 'string' },
      userId: { type: 'string' },
      date: { type: 'string' },
      weight: { type: 'number' },
      bodyFatPct: { type: 'number', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  })

  fastify.addSchema({
    $id: 'ParsedFood',
    type: 'object',
    properties: {
      name: { type: 'string' },
      servingSize: { type: 'number' },
      servingLabel: { type: 'string' },
      kcal: { type: 'number' },
      protein: { type: 'number' },
      carbs: { type: 'number' },
      fat: { type: 'number' },
      fiber: { type: 'number' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    },
  })

  fastify.addSchema({
    $id: 'ErrorResponse',
    type: 'object',
    properties: {
      error: { type: 'string' },
    },
  })
})
