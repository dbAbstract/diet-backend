# Diet App — Backend Project Context

## What Is This?

This is the backend for a personal diet tracking app called **Diet**. It is a solo personal project (single user, no public release planned for MVP). The goal is to replace an ad-hoc ChatGPT-based meal logging workflow with a proper persistent, AI-assisted diet tracker.

---

## The Problem Being Solved

Previously, the developer logged meals by pasting food data into a ChatGPT project each week. Pain points:
- No persistence across weeks — each chat was an isolated silo
- No weight or activity trend tracking over time
- Friction to find the right chat and start a new one each week
- No visual progress representation

---

## Full Stack

| Layer | Tech |
|---|---|
| iOS UI | SwiftUI |
| Android UI | Jetpack Compose |
| Shared mobile logic | KMP (Kotlin Multiplatform) |
| Backend | Node.js + Fastify + TypeScript |
| Database | PostgreSQL via Neon (free managed) |
| ORM | Prisma |
| AI | Anthropic API (Claude) |
| Hosting | MacBook Pro M4 + Cloudflare Tunnel |
| Auth | Deferred — single hardcoded user for MVP |

---

## Backend Folder Structure

```
diet-backend/
├── src/
│   ├── routes/         # Fastify route handlers
│   ├── plugins/        # Fastify plugins (db, anthropic, etc.)
│   ├── domain/         # Domain types and interfaces
│   └── index.ts        # Entry point
├── prisma/
│   └── schema.prisma   # DB schema
├── .env                # Environment variables (never commit)
├── tsconfig.json
└── package.json
```

---

## Domain Models

### Macros
```typescript
Macros {
  kcal: number
  protein: number  // grams
  carbs: number    // grams
  fat: number      // grams
  fibre: number    // grams
}
```

### FoodItem
A single food or product with fixed macros per serving. Can be a packaged product (e.g. Oreos, whey protein) or a raw ingredient (e.g. egg, milk).

```typescript
FoodItem {
  id: string
  name: string
  servingSize: number       // in g or ml
  servingLabel: string      // e.g. "1 cup", "1 scoop"
  macros: Macros            // per serving
  source: CUSTOM | AI_GENERATED
}
```

### Recipe
A named collection of FoodItems with quantities. Macros are always **derived/computed**, never stored — prevents stale data.

```typescript
Recipe {
  id: string
  name: string
  ingredients: Array<{
    foodItem: FoodItem
    quantity: number        // number of servings
  }>
  // macros are computed from ingredients, not persisted
}
```

### MealEntry
A single logged food or recipe within a day. Macros are **snapshotted at log time** — so editing a FoodItem later doesn't retroactively change history.

```typescript
MealEntry {
  id: string
  mealType: BREAKFAST | LUNCH | DINNER | SNACK
  food: FoodItem | Recipe
  quantity: number          // number of servings
  macros: Macros            // snapshot at log time
  loggedAt: timestamp
}
```

### DailyLog
```typescript
DailyLog {
  id: string
  userId: string
  date: Date
  entries: MealEntry[]
}
```

### WeightEntry
```typescript
WeightEntry {
  id: string
  userId: string
  date: Date
  weight: number            // kg
}
```

### User & Goals
```typescript
User {
  id: string
  name: string
  height: number            // cm
  dateOfBirth: Date
  goals: UserGoals
}

UserGoals {
  targetCalories: number
  targetProtein: number     // g
  targetCarbs: number       // g
  targetFat: number         // g
}
```

---

## Key Design Decisions

- **Recipe macros are computed not stored** — always derive from ingredients dynamically
- **MealEntry macros are snapshotted** — historical logs must not change when food data is edited
- **FoodItem is the atomic unit** — Recipes reference FoodItems with quantities. No redundant food storage (e.g. "egg sandwich with 2 eggs" and "egg sandwich with 3 eggs" are not separate foods — they are the same Recipe with a different quantity at log time)
- **Auth is deferred** — MVP is single user, no login system yet
- **AI is used for meal parsing** — when a user can't find a food in their library, they describe it in natural language via the Anthropic API. The AI returns structured macro data.

---

## App Screens (MVP)

1. **Today Dashboard** — calorie ring, macro progress bars, meal log by section (Breakfast/Lunch/Dinner/Snacks)
2. **Log Food** — search saved foods first, recent foods row, AI chat as fallback. After logging a new food via AI, user is prompted to save it to their library.
3. **AI Chat (Log with AI)** — conversational meal entry, live macro analysis card, Confirm and Save CTA
4. **History** — week strip, 7-day bar chart vs target, weekly summary card (avg macros + adherence %), expandable past days
5. **Weight Tracker** — line chart over time, key stats, chronological log, FAB to add today's weight

Deferred: Personal Food Library screen, Profile/Settings screen

---

## AI Integration Notes

- Use the **Anthropic API** (Claude) for natural language meal parsing
- The AI should ask clarifying questions when a meal is ambiguous (e.g. "was it homemade or restaurant?")
- The AI response should return structured data: food name, estimated macros, confidence level
- Store a `source: AI_GENERATED` flag on FoodItems created via AI so they can be reviewed/edited

---

## Environment Variables Needed

```
DATABASE_URL=           # Neon PostgreSQL connection string
ANTHROPIC_API_KEY=      # Claude API key
PORT=3000
```

---

## Future / Deferred Features

- Auth (Clerk or Supabase)
- Whoop API integration for activity data
- Barcode scanning
- Meal photo recognition
- Weekly AI-generated coaching summaries
- Personal food library management screen
