import Anthropic from '@anthropic-ai/sdk'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ParsedFood = {
  name: string
  servingSize: number
  servingLabel: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  confidence: 'high' | 'medium' | 'low'
}

export type ParseMealResult =
  | { type: 'parsed'; food: ParsedFood }
  | { type: 'clarification'; question: string }

const SYSTEM_PROMPT = `You are a nutrition assistant helping a user log their meals.

When the user describes food they've eaten, extract the nutritional information and respond with a JSON object in one of two formats:

If you have enough information to estimate macros:
{
  "type": "parsed",
  "food": {
    "name": "Food name",
    "servingSize": 100,
    "servingLabel": "1 serving",
    "kcal": 000,
    "protein": 00,
    "carbs": 00,
    "fat": 00,
    "fiber": 00,
    "confidence": "high" | "medium" | "low"
  }
}

If you need more information to give a reasonable estimate:
{
  "type": "clarification",
  "question": "Your clarifying question here"
}

Rules:
- All macro values are per the serving described by the user
- servingSize is in grams or ml
- Use "low" confidence for restaurant meals or homemade dishes where ingredients are unknown
- Use "medium" confidence for common foods with well-known macros
- Use "high" confidence for packaged foods with standard nutritional info
- Always respond with raw valid JSON only — no markdown, no code fences, no extra text`

export function makeMealParserService(client: Anthropic) {
  return {
    async parseMessage(messages: ChatMessage[]): Promise<ParseMealResult> {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages,
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      const text = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

      try {
        return JSON.parse(text) as ParseMealResult
      } catch {
        return {
          type: 'clarification',
          question: text,
        }
      }
    },
  }
}
