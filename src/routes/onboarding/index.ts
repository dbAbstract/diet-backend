import { FastifyPluginAsync } from 'fastify'
import { Sex, ActivityLevel } from '../../generated/prisma/client.js'
import { makeOnboardingService } from '../../services/onboarding.service.js'

const onboarding: FastifyPluginAsync = async (fastify) => {
  const service = makeOnboardingService()

  // GET /onboarding/steps
  fastify.get('/steps', {
    schema: {
      tags: ['Onboarding'],
      summary: 'Ordered list of onboarding step definitions — mobile renders based on type discriminator',
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'type', 'title'],
            properties: {
              key: { type: 'string' },
              type: {
                type: 'string',
                enum: ['TEXT_INPUT', 'DATE_INPUT', 'NUMBER_INPUT', 'SINGLE_SELECT', 'RANGE_PICKER', 'GOAL_SUGGESTION', 'SUMMARY'],
              },
              title: { type: 'string' },
              subtitle: { type: 'string' },
            },
            additionalProperties: true,
          },
        },
      },
    },
  }, async () => {
    return service.getSteps()
  })

  // POST /onboarding/goal-suggestion
  fastify.post('/goal-suggestion', {
    schema: {
      tags: ['Onboarding'],
      summary: 'Returns BMI-based target weight suggestion and body fat context for the goal weight step',
      body: {
        type: 'object',
        required: ['sex', 'height', 'dateOfBirth', 'currentWeightKg'],
        properties: {
          sex: { type: 'string', enum: ['MALE', 'FEMALE'] },
          height: { type: 'number', description: 'cm' },
          dateOfBirth: { type: 'string', format: 'date' },
          currentWeightKg: { type: 'number' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            suggestedTargetKg: { type: 'number' },
            current: {
              type: 'object',
              properties: {
                weightKg: { type: 'number' },
                bmi: { type: 'number' },
                bodyFat: {
                  type: 'object',
                  properties: {
                    estimatedPct: { type: 'number' },
                    range: {
                      type: 'object',
                      properties: {
                        min: { type: 'number' },
                        max: { type: 'number' },
                      },
                    },
                    category: { type: 'string' },
                  },
                },
              },
            },
            target: {
              type: 'object',
              properties: {
                weightKg: { type: 'number' },
                bmi: { type: 'number' },
                bodyFat: {
                  type: 'object',
                  properties: {
                    estimatedPct: { type: 'number' },
                    range: {
                      type: 'object',
                      properties: {
                        min: { type: 'number' },
                        max: { type: 'number' },
                      },
                    },
                    category: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const body = request.body as {
      sex: Sex
      height: number
      dateOfBirth: string
      currentWeightKg: number
    }
    return service.goalSuggestion({
      ...body,
      dateOfBirth: new Date(body.dateOfBirth),
    })
  })

  // POST /onboarding/summary
  fastify.post('/summary', {
    schema: {
      tags: ['Onboarding'],
      summary: 'Calculates TDEE, daily calorie target and suggested macros — shown on the final summary step before POST /user',
      body: {
        type: 'object',
        required: ['sex', 'height', 'dateOfBirth', 'currentWeightKg', 'activityLevel', 'dailyDeficitKcal'],
        properties: {
          sex: { type: 'string', enum: ['MALE', 'FEMALE'] },
          height: { type: 'number', description: 'cm' },
          dateOfBirth: { type: 'string', format: 'date' },
          currentWeightKg: { type: 'number' },
          activityLevel: { type: 'string', enum: ['SEDENTARY', 'LIGHTLY_ACTIVE'] },
          dailyDeficitKcal: { type: 'number' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            tdee: { type: 'number', description: 'Total daily energy expenditure' },
            dailyCalorieTarget: { type: 'number', description: 'TDEE minus deficit' },
            weeklyLossKg: { type: 'number', description: 'Expected weekly weight loss at this deficit' },
            suggestedMacros: {
              type: 'object',
              properties: {
                protein: { type: 'number', description: 'g' },
                carbs: { type: 'number', description: 'g' },
                fat: { type: 'number', description: 'g' },
              },
            },
          },
        },
      },
    },
  }, async (request) => {
    const body = request.body as {
      sex: Sex
      height: number
      dateOfBirth: string
      currentWeightKg: number
      activityLevel: ActivityLevel
      dailyDeficitKcal: number
    }
    return service.calculateSummary({
      ...body,
      dateOfBirth: new Date(body.dateOfBirth),
    })
  })
}

export default onboarding
