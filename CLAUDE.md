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
| ORM | Prisma (split schema — one file per model in `prisma/schema/`) |
| AI | Anthropic API (claude-sonnet-4-6) |
| API Docs | Swagger UI via `@fastify/swagger` at `/documentation` |
| Hosting | MacBook Pro M4 + Cloudflare Tunnel |
| Auth | Firebase Auth (ID token verification via Firebase Admin SDK) |

---

## Backend Folder Structure

```
diet-backend/
├── src/
│   ├── routes/             # Fastify route handlers (one folder per domain)
│   │   ├── onboarding/     # Onboarding steps, goal suggestion, summary
│   │   ├── user/           # GET, POST, PATCH /user
│   │   ├── food-items/     # CRUD /food-items
│   │   ├── recipes/        # CRUD /recipes
│   │   ├── logs/           # Daily logs and meal entries /logs/:date
│   │   ├── weight/         # Weight entries /weight
│   │   ├── activity/       # Activity entries /activity
│   │   ├── history/        # Weekly history and finalization /history
│   │   ├── ai/             # Natural language meal/activity parsing
│   │   └── app/            # App launch state /app/state
│   ├── services/           # Business logic
│   ├── repositories/       # Prisma data access layer
│   ├── plugins/            # Fastify plugins (db, anthropic, swagger, schemas, auth)
│   ├── generated/          # Prisma generated client (do not edit)
│   └── app.ts              # Fastify app setup and plugin registration
├── prisma/
│   ├── schema/             # Split schema — one .prisma file per model
│   │   ├── base.prisma     # datasource + generator
│   │   ├── user.prisma
│   │   ├── food.prisma
│   │   ├── logging.prisma
│   │   ├── weight.prisma
│   │   ├── activity.prisma
│   │   └── week-summary.prisma
│   └── migrations/
├── .env                    # Environment variables (never commit)
├── tsconfig.json
└── package.json
```

---

## Domain Models

### Macros
```typescript
// Flattened on all models — no separate Macros table
{
  kcal: number
  protein: number  // grams
  carbs: number    // grams
  fat: number      // grams
  fiber: number    // grams
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
  kcal / protein / carbs / fat / fiber: number   // per serving, flattened
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
  foodItemId?: string       // exactly one of these is set
  recipeId?: string
  quantity: number          // number of servings
  notes?: string
  kcal / protein / carbs / fat / fiber: number   // snapshot at log time
  loggedAt: timestamp
}
```

### DailyLog
Auto-created on first access for a given date.

```typescript
DailyLog {
  id: string
  userId: string
  date: Date                // unique per user per day
  entries: MealEntry[]
}
```

### WeightEntry
```typescript
WeightEntry {
  id: string
  userId: string
  date: Date                // unique per user per day; source of truth (not createdAt)
  weight: number            // kg
  bodyFatPct?: number       // %, optional
}
```

### ActivityEntry
A logged exercise or activity for a given day, with estimated calories burned.

```typescript
ActivityEntry {
  id: string
  userId: string
  date: Date                // date of the activity (source of truth, not createdAt)
  description: string       // e.g. "45 min run"
  kcalBurned: number
  source: AI_ESTIMATED | WHOOP | MANUAL
}
```

### User
Goals are stored directly on the User model (no separate UserGoals table).

```typescript
User {
  id: string
  firebaseUid: string       // unique; used to scope all data to authenticated user
  name: string
  sex: MALE | FEMALE
  height: number            // cm
  dateOfBirth: Date
  activityLevel: SEDENTARY | LIGHTLY_ACTIVE  // used to compute TDEE activity multiplier
  targetWeightKg: number    // goal weight in kg
  dailyDeficitKcal: number  // target daily calorie deficit (e.g. 400)
  targetProtein: number     // g
  targetCarbs: number       // g
  targetFat: number         // g
  createdAt: timestamp
  updatedAt: timestamp
}
```

### WeekSummary
Created automatically when the app detects a completed week with logged data. Finalized explicitly by the user.

```typescript
WeekSummary {
  id: string
  userId: string
  weekStart: Date           // always a Monday
  status: PENDING_REVIEW | FINALIZED
  calorieTarget: number     // active target during this week
  nextWeekTarget?: number   // algorithmically adjusted target for next week
  avgKcal?: number
  avgWeight?: number        // kg
  adherentDays?: number
  adherencePct?: number
  weightDelta?: number      // actual kg change vs previous week avg
  expectedDelta?: number    // expected kg change from deficit alone
  aiInsight?: string        // LLM-generated coaching note
  finalizedAt?: Date
}
```

---

## Key Design Decisions

- **Recipe macros are computed not stored** — always derived from ingredients dynamically
- **MealEntry macros are snapshotted** — historical logs must not change when food data is edited
- **FoodItem is the atomic unit** — Recipes reference FoodItems with quantities
- **Weight entries are date-keyed** — the `date` field is the source of truth everywhere, not `createdAt`. Backdating a weight entry works correctly throughout the system.
- **Calorie target is dynamic** — derived from TDEE (Mifflin-St Jeor BMR × `activityLevel` multiplier) minus deficit on first use; subsequently driven by `nextWeekTarget` from the last finalized `WeekSummary`
- **Effective daily calorie allowance** = base target + sum of `kcalBurned` from activity entries on that day
- **Weekly finalization is explicit** — the app detects pending reviews on launch (`GET /app/state`) but the user triggers finalization. Finalization runs the deficit correction algorithm and optionally generates an AI insight.
- **Firebase Auth** — all routes require a Firebase ID token in `Authorization: Bearer <token>`. The token is verified server-side; `firebaseUid` scopes all data to the authenticated user.
- **Split Prisma schema** — one `.prisma` file per domain model in `prisma/schema/`

---

## API Routes Summary

| Method | Path | Description |
|---|---|---|
| GET | `/onboarding/steps` | Ordered polymorphic step definitions — mobile renders based on `type` discriminator |
| POST | `/onboarding/goal-suggestion` | BMI-based target weight suggestion + body fat context |
| POST | `/onboarding/summary` | TDEE, daily calorie target, weekly loss, suggested macros |
| POST | `/user` | Create user (end of onboarding) |
| GET | `/user` | Get user profile and goals |
| PATCH | `/user` | Update user profile or goals |
| GET | `/user/activity-levels` | Activity level options with descriptions |
| GET | `/food-items` | List food items (supports `?search=`) |
| GET | `/food-items/recent` | Recently logged food items (supports `?limit=`) |
| GET | `/food-items/:id` | Get food item by ID |
| POST | `/food-items` | Create food item |
| PATCH | `/food-items/:id` | Update food item |
| DELETE | `/food-items/:id` | Delete food item |
| GET | `/recipes` | List recipes |
| GET | `/recipes/:id` | Get recipe by ID |
| POST | `/recipes` | Create recipe |
| PATCH | `/recipes/:id` | Update recipe |
| DELETE | `/recipes/:id` | Delete recipe |
| GET | `/logs/:date` | Get daily log (auto-creates if missing) |
| GET | `/logs/:date/summary` | Daily macro totals vs targets |
| POST | `/logs/:date/entries` | Log a meal entry |
| PATCH | `/logs/:date/entries/:entryId` | Update a meal entry |
| DELETE | `/logs/:date/entries/:entryId` | Delete a meal entry |
| GET | `/weight` | List weight entries (supports `?from=&to=` date range) |
| GET | `/activity` | List activity entries (supports `?from=&to=` date range) |
| POST | `/activity` | Log an activity entry manually |
| DELETE | `/activity/:id` | Delete an activity entry |
| POST | `/ai/parse-activity` | Multi-turn natural language activity parsing |
| POST | `/weight` | Log a weight entry |
| DELETE | `/weight/:id` | Delete a weight entry |
| GET | `/history/weeks` | List weeks with data (paginated) |
| GET | `/history/weeks/:weekStart` | Detailed week summary |
| POST | `/history/weeks/:weekStart/finalize` | Finalize a past week |
| POST | `/history/weeks/:weekStart/insight` | Generate AI insight for a finalized week |
| GET | `/app/state` | App launch state — current week target + pending review |
| POST | `/ai/parse-meal` | Multi-turn natural language meal parsing |

---

## AI Integration

### Meal Parsing (`POST /ai/parse-meal`)
- Multi-turn conversation — client maintains message history and re-sends it each turn
- Returns `{ type: "parsed", food: ParsedFood }` or `{ type: "clarification", question: string }`
- `ParsedFood` includes name, servingSize, servingLabel, all macros, and a `confidence` field (`high | medium | low`)
- Client saves the result as a `FoodItem` with `source: AI_GENERATED`, then logs it normally

### Weekly Insight (`POST /history/weeks/:weekStart/insight`)
- Called after finalization; generates a 2-3 sentence coaching summary using claude-sonnet-4-6
- Considers calorie target, avg actual kcal, adherence %, weight change vs expected
- Stored on the `WeekSummary` record as `aiInsight`

---

## Calorie Target Algorithm

1. **Initial target**: `TDEE − dailyDeficitKcal` (Mifflin-St Jeor BMR × `activityLevel` multiplier using latest logged weight)
2. **After each finalized week**: deficit is adjusted based on actual vs expected weight loss
   - Expected weekly loss = `(currentDeficit × 7) / 7700`
   - Shortfall = expected − actual loss
   - Correction = `shortfall × (7700 / 7) × 0.5` (50% damping to avoid oscillation)
   - New deficit is clamped to `[200, 750]` kcal/day
3. **Known limitation**: week-to-week weight is noisy; a threshold guard or multi-week trend is a planned improvement

---

## Environment Variables

```
DATABASE_URL=               # Neon PostgreSQL connection string
ANTHROPIC_API_KEY=          # Claude API key
FIREBASE_PROJECT_ID=        # Firebase project ID (for Admin SDK)
FIREBASE_CLIENT_EMAIL=      # Firebase service account client email
FIREBASE_PRIVATE_KEY=       # Firebase service account private key
PORT=3000                   # optional, defaults to 3000
```

---

## TODO

Active iteration backlog — remove items as they ship, add new ones as they come up.

### In Progress
_nothing currently in flight_

### Up Next
_nothing — backlog clear, add next features here_

### Recently Shipped
- Firebase Auth — all routes now require Firebase ID token; `firebaseUid` scopes data per user
- Backend-driven onboarding endpoints (`GET /onboarding/steps`, `POST /onboarding/goal-suggestion`, `POST /onboarding/summary`)
- Dynamic `activityLevel` on User — replaces hardcoded 1.55 activity factor in TDEE calculation
- Activity logging via LLM chat (`POST /ai/parse-activity`, `POST /activity`) — daily calorie allowance = base target + activityKcal
- `GET /logs/:date/summary` now includes `activityKcal`, `targets.kcal`, and `targets.effectiveKcal`
- Meal photo recognition included in the chat UX (`POST /ai/parse-meal` accepts image attachments)

### Deferred
- Whoop API integration — replace `AI_ESTIMATED` activity entries with real strain/calorie data (`source: WHOOP`)
- Multi-week weight trend for calorie target adjustment (reduce week-to-week noise sensitivity)
- Barcode scanning
- Personal food library management screen
- Profile/Settings screen