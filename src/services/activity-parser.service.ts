import Anthropic from '@anthropic-ai/sdk'
import { ChatMessage } from './meal-parser.service.js'

export type ParsedActivity = {
  description: string
  durationMinutes: number
  kcalBurned: number
  confidence: 'high' | 'medium' | 'low'
}

export type ParseActivityResult =
  | { type: 'parsed'; activity: ParsedActivity }
  | { type: 'clarification'; question: string }

function buildSystemPrompt(weightKg: number): string {
  return `You are a fitness assistant helping a user log their activity and estimate calories burned.

The user weighs ${weightKg} kg. Use this for accurate calorie calculations.

When the user describes an activity, estimate the calories burned and respond with a JSON object in one of two formats:

If you have enough information to estimate calories burned:
{
  "type": "parsed",
  "activity": {
    "description": "Short description of the activity",
    "durationMinutes": 45,
    "kcalBurned": 350,
    "confidence": "high" | "medium" | "low"
  }
}

If you need more information to give a reasonable estimate:
{
  "type": "clarification",
  "question": "Your clarifying question here"
}

Rules:
- Ask about duration if not provided
- Ask about pace/intensity for cardio (easy jog vs tempo run makes a big difference)
- Ask about distance for running, cycling, swimming if not given
- For gym/weights: ask about session length and intensity
- Use "low" confidence for vague activities (e.g. "went to the gym")
- Use "medium" confidence when key details are known but some estimation is needed
- Use "high" confidence when duration, type, and intensity are all clear
- Always respond with raw valid JSON only — no markdown, no code fences, no extra text`
}

export function makeActivityParserService(client: Anthropic) {
  return {
    async parseMessage(messages: ChatMessage[], weightKg: number): Promise<ParseActivityResult> {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: buildSystemPrompt(weightKg),
        messages,
      })

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''

      try {
        const parsed = JSON.parse(text)
        return parsed as ParseActivityResult
      } catch {
        return { type: 'clarification', question: text }
      }
    },
  }
}
