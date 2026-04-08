import Anthropic from '@anthropic-ai/sdk'

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  image?: string    // base64-encoded image data, first turn only
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
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

The user may describe their meal in text, share a photo, or both. Use all available information together to identify the food and estimate its nutritional content.

When analysing an image:
- Identify all visible food items
- Estimate portion sizes from visual cues (plate size, utensils, context)
- If something is ambiguous (e.g. could be green beans or green chillies, could be chicken or tofu), ask — do not guess
- Ask about cooking method if it meaningfully affects macros (e.g. fried vs steamed)
- Ask about ingredients you cannot see but that likely matter (e.g. oil used, sauce, dressing)

Respond with a JSON object in one of two formats:

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

If you need more information:
{
  "type": "clarification",
  "question": "Your clarifying question here"
}

Rules:
- All macro values are per the serving described or shown
- servingSize is in grams or ml
- Use "low" confidence for restaurant meals or homemade dishes where ingredients are unknown
- Use "medium" confidence when key details are visible or confirmed but some estimation remains
- Use "high" confidence for clearly identifiable packaged foods or very standard dishes
- Always respond with raw valid JSON only — no markdown, no code fences, no extra text`

function buildAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((msg) => {
    if (msg.role === 'assistant' || !msg.image) {
      return { role: msg.role, content: msg.content }
    }

    // User message with image — build multimodal content array
    const content: Anthropic.ContentBlockParam[] = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: msg.mimeType ?? 'image/jpeg',
          data: msg.image,
        },
      },
    ]

    if (msg.content.trim()) {
      content.push({ type: 'text', text: msg.content })
    }

    return { role: 'user' as const, content }
  })
}

export function makeMealParserService(client: Anthropic) {
  return {
    async parseMessage(messages: ChatMessage[]): Promise<ParseMealResult> {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: buildAnthropicMessages(messages),
      })

      const raw = response.content[0].type === 'text' ? response.content[0].text : ''
      const text = raw.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

      try {
        return JSON.parse(text) as ParseMealResult
      } catch {
        return { type: 'clarification', question: text }
      }
    },
  }
}
