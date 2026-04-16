# Diet App — Backend

Node.js + Fastify + TypeScript backend for a personal AI-assisted diet tracker. Hosted on a MacBook Pro M4 via Cloudflare Tunnel.

---

## Stack

| Concern | Tech |
|---|---|
| Runtime | Node.js + Fastify + TypeScript |
| Database | PostgreSQL (Neon managed) via Prisma ORM |
| Auth | Firebase Auth (ID token verification) |
| AI | Anthropic API — claude-sonnet-4-6 |
| API Docs | Swagger UI at `/documentation` |

---

## Authentication

Every request requires a Firebase ID token:

```
Authorization: Bearer <firebase-id-token>
```

- Mobile signs in via Firebase SDK → receives an ID token (JWT, ~1hr TTL)
- Backend verifies the token via Firebase Admin SDK and extracts the Firebase UID
- All data is scoped to that UID — no user ID is ever passed in request bodies or URLs
- `/docs` and `/documentation` are the only unauthenticated routes

---

## Data Model Overview

### Macros (flattened on all relevant models)
```
kcal, protein (g), carbs (g), fat (g), fiber (g)
```

### FoodItem
Atomic unit. A single food or product with macros per serving.
- `servingSize`: number (g or ml)
- `servingLabel`: human label e.g. "1 cup", "1 scoop"
- `source`: `CUSTOM` | `AI_GENERATED`
- Macros are stored per serving

### Recipe
Named collection of FoodItems with quantities.
- Macros are **computed on the fly** from ingredients — never stored
- Editing a FoodItem updates the Recipe's computed macros automatically

### MealEntry
A logged food or recipe within a day.
- Macros are **snapshotted at log time** — historical entries are immutable to FoodItem edits
- `mealType`: `BREAKFAST` | `LUNCH` | `DINNER` | `SNACK`
- `quantity`: number of servings
- Has either `foodItemId` or `recipeId`, never both

### DailyLog
Container for a day's meal entries. Auto-created on first access for a given date.

### WeightEntry
- `date` is the source of truth (not `createdAt`) — backdating works correctly
- `weight`: kg; `bodyFatPct`: optional %

### ActivityEntry
A logged exercise for a given day.
- `kcalBurned`: estimated calories burned
- `source`: `AI_ESTIMATED` | `MANUAL` | `WHOOP` (Whoop integration not yet built)
- Effective daily calorie allowance = base target + sum of `kcalBurned` for that day

### User
Goals stored directly on the User model (no separate goals table).
- `activityLevel`: `SEDENTARY` | `LIGHTLY_ACTIVE` — baseline multiplier for TDEE
- `dailyDeficitKcal`: target deficit (e.g. 400 kcal/day)
- `targetProtein/Carbs/Fat`: macro targets in grams
- `firebaseUid`: unique — the identity bridge between Firebase and the DB

### WeekSummary
Auto-created when the app detects a completed week with data.
- `status`: `PENDING_REVIEW` | `FINALIZED`
- Finalization computes actuals and adjusts next week's calorie target
- `nextWeekTarget`: adjusted calorie target for the following week
- `aiInsight`: optional LLM-generated coaching note (generated separately after finalization)

---

## Calorie Target Logic

1. **Initial target**: `TDEE − dailyDeficitKcal` using Mifflin-St Jeor BMR × activity multiplier
2. **After each finalized week**: deficit adjusts based on actual vs expected weight loss (50% damping, clamped to 200–750 kcal/day)
3. **Daily effective target**: base target + activity kcal burned that day

---

## Onboarding Flow

Onboarding is **backend-driven** — the mobile app fetches step definitions and renders them generically.

### Step 1 — Fetch step definitions
```
GET /onboarding/steps
```
Returns an ordered array of steps. Each step has a `type` discriminator the mobile uses to render the appropriate UI:

| # | key | type |
|---|-----|------|
| 1 | `name` | `TEXT_INPUT` |
| 2 | `sex` | `SINGLE_SELECT` |
| 3 | `dateOfBirth` | `DATE_INPUT` |
| 4 | `height` | `NUMBER_INPUT` (cm) |
| 5 | `currentWeightKg` | `NUMBER_INPUT` (kg) |
| 6 | `activityLevel` | `SINGLE_SELECT` (options + descriptions included in step definition) |
| 7 | `targetWeightKg` | `GOAL_SUGGESTION` — call `POST /onboarding/goal-suggestion` on arrival |
| 8 | `dailyDeficitKcal` | `RANGE_PICKER` (deficit bands Gentle/Moderate/Aggressive included in step definition) |
| 9 | `summary` | `SUMMARY` — call `POST /onboarding/summary` on arrival |

### Step 2 — Goal suggestion (step 7)
```
POST /onboarding/goal-suggestion
Body: { sex, height, dateOfBirth, currentWeightKg }
```
Returns a BMI-based suggested target weight + current/target body fat context for display.

### Step 3 — Summary (step 9)
```
POST /onboarding/summary
Body: { sex, height, dateOfBirth, currentWeightKg, activityLevel, dailyDeficitKcal }
```
Returns TDEE, daily calorie target, expected weekly loss, and suggested macros. User can adjust macros before confirming.

### Step 4 — Create user (end of onboarding)
```
POST /user
Body: { name, sex, height, dateOfBirth, activityLevel, targetWeightKg, dailyDeficitKcal, targetProtein, targetCarbs, targetFat }
```
Requires a valid Firebase ID token — Firebase sign-in must happen before this call.

---

## App Launch

```
GET /app/state
```
Called on every app open. Returns:
- `currentWeek`: `{ weekStart, calorieTarget }` — the active kcal target for this week
- `pendingReview`: `{ weekStart, daysLogged, avgKcal, avgWeight }` or `null` — whether a past week needs finalizing

---

## API Reference

### User
| Method | Path | Description |
|---|---|---|
| POST | `/user` | Create user (once, end of onboarding) |
| GET | `/user` | Get user profile and goals |
| PATCH | `/user` | Update profile or goals |
| GET | `/user/activity-levels` | Activity level options with descriptions |

### Food Items
| Method | Path | Description |
|---|---|---|
| GET | `/food-items` | List food items (supports `?search=`) |
| GET | `/food-items/recent` | Recently logged items (supports `?limit=`) |
| GET | `/food-items/:id` | Get by ID |
| POST | `/food-items` | Create |
| PATCH | `/food-items/:id` | Update |
| DELETE | `/food-items/:id` | Delete |

### Recipes
| Method | Path | Description |
|---|---|---|
| GET | `/recipes` | List recipes |
| GET | `/recipes/:id` | Get by ID (includes computed macros) |
| POST | `/recipes` | Create |
| PATCH | `/recipes/:id` | Update |
| DELETE | `/recipes/:id` | Delete |

### Daily Logs
| Method | Path | Description |
|---|---|---|
| GET | `/logs/:date` | Get daily log — auto-creates if missing. Date format: `YYYY-MM-DD` |
| GET | `/logs/:date/summary` | Macro totals vs targets, includes `activityKcal`, `targets.kcal`, `targets.effectiveKcal` |
| POST | `/logs/:date/entries` | Log a meal entry. Body: `{ mealType, quantity, foodItemId?, recipeId?, notes? }` |
| PATCH | `/logs/:date/entries/:entryId` | Update entry (mealType, quantity, notes only — not food source) |
| DELETE | `/logs/:date/entries/:entryId` | Delete entry |

### Weight
| Method | Path | Description |
|---|---|---|
| GET | `/weight` | List entries (supports `?from=&to=` ISO dates) |
| POST | `/weight` | Log entry. Body: `{ date, weight, bodyFatPct? }` |
| DELETE | `/weight/:id` | Delete entry |

### Activity
| Method | Path | Description |
|---|---|---|
| GET | `/activity` | List entries (supports `?from=&to=` ISO dates) |
| POST | `/activity` | Log manually. Body: `{ date, description, kcalBurned }` |
| DELETE | `/activity/:id` | Delete entry |

### AI
| Method | Path | Description |
|---|---|---|
| POST | `/ai/parse-meal` | Multi-turn meal parsing from text and/or photo |
| POST | `/ai/parse-activity` | Multi-turn activity parsing from natural language |

### History
| Method | Path | Description |
|---|---|---|
| GET | `/history/weeks` | List weeks with data (supports `?page=&pageSize=`) |
| GET | `/history/weeks/:weekStart` | Detailed week view — `weekStart` must be a Monday |
| POST | `/history/weeks/:weekStart/finalize` | Finalize week, compute actuals, adjust next week's target |
| POST | `/history/weeks/:weekStart/insight` | Generate AI coaching insight (call after finalize) |

---

## AI Endpoints

Both AI endpoints use a **multi-turn conversation** pattern. The client maintains the full message history and re-sends it on each turn.

### Meal parsing — `POST /ai/parse-meal`

```json
{
  "messages": [
    {
      "role": "user",
      "content": "I had a bowl of oatmeal with banana",
      "image": "<base64>",        // optional, first turn only
      "mimeType": "image/jpeg"    // required when image is provided
    }
  ]
}
```

Response is either:
```json
{ "type": "parsed", "food": { "name", "servingSize", "servingLabel", "kcal", "protein", "carbs", "fat", "fiber", "confidence" } }
{ "type": "clarification", "question": "How much oatmeal — a small bowl or large?" }
```

`confidence`: `high` | `medium` | `low`

Typical flow:
1. User describes or photos a meal → call `/ai/parse-meal`
2. If `clarification` → show question, append assistant + next user message, call again
3. If `parsed` → save the result as a `FoodItem` with `source: AI_GENERATED`, then log it via `POST /logs/:date/entries`

### Activity parsing — `POST /ai/parse-activity`

Same multi-turn pattern, text only. Returns:
```json
{ "type": "parsed", "activity": { "description", "durationMinutes", "kcalBurned", "confidence" } }
{ "type": "clarification", "question": "..." }
```

After parsing, log via `POST /activity`.

---

## Error Responses

All errors return `{ "error": "<message>" }` with an appropriate HTTP status. Common error strings:
- `USER_NOT_FOUND` — 404
- `FOOD_NOT_FOUND` / `RECIPE_NOT_FOUND` — 404
- `MISSING_FOOD_SOURCE` / `AMBIGUOUS_FOOD_SOURCE` — 400 (provide exactly one of foodItemId or recipeId)
- `ALREADY_FINALIZED` — 400
- `NOT_FINALIZED` — 400 (insight requires finalized week)
- Missing/invalid token — 401
