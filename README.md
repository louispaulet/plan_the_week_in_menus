# Week Menu Planner

A weekly menu planning app that helps users plan lunch and dinner for every day of the week while respecting dietary, nutritional, budget, preference, and household rules.

The product uses a Vite + React + TailwindCSS frontend, a singular-file Cloudflare Worker backend, and Cloudflare-compatible persistence. OpenAI API calls to `gpt-5-nano` happen only in the backend.

The core idea is simple: the user never chats with the LLM. The LLM silently generates structured interface instructions, suggestions, warnings, buttons, forms, and schedule updates. The frontend renders those instructions as a clean planning interface.

## Product Vision

Planning meals should feel like arranging blocks on a board, not negotiating with a chatbot.

The app should help users:

- Plan a week of menus with 2 meals per day
- Reuse saved food rules and preferences
- Get meal suggestions in small sets of 3–4 options
- See rule-breaking warnings immediately
- Fix conflicts through buttons and guided choices
- Save weekly plans
- Build a personal library of reusable planning blocks

Example rules:

- Eat at least 5 fruits and vegetables per day
- Keep weekday dinners low carb
- Avoid specific ingredients
- Prefer fast meals on work nights
- Prefer air fryer-compatible recipes
- Keep the week cheap and healthy
- Use leftovers efficiently

## The Big UX Rule

There is no chatbot interface.

The LLM should never directly write into the UI as an assistant. Instead, backend calls to `gpt-5-nano` return structured JSON. The frontend renders that JSON into known, safe UI components.

Examples of generated UI:

- Meal option cards
- Choice buttons
- Rule warnings
- Editable form fields
- Ingredient chips
- Schedule patches
- Saved rule blocks
- Next-step panels

The user should feel like they are using an intelligent planning app, not reading generated text.

## Target Stack

### Frontend

- Vite
- React
- TailwindCSS
- Component-driven UI
- Deterministic renderer for generated interface specs

### Backend

- Cloudflare Worker
- One main JavaScript file
- Backend-only OpenAI API calls
- JSON validation of all model responses
- Database access and API routing

### Database

Recommended Cloudflare storage:

- Cloudflare D1 for structured relational data
- Cloudflare KV for reusable interface templates and prompt/context blocks if useful
- Cloudflare R2 only later for exports, assets, or large user data

## Core User Journey

### 1. Start a Plan

The user creates a weekly plan. The app shows a schedule with 7 days and 2 meal slots per day:

- Monday lunch
- Monday dinner
- Tuesday lunch
- Tuesday dinner
- …
- Sunday lunch
- Sunday dinner

The user can start from scratch or load a previous plan/rule set.

### 2. Add Rules

The user adds planning rules such as:

- “Low carb dinners during the week.”
- “At least 5 fruits and vegetables per day.”
- “Avoid bell peppers.”
- “Prefer cheap meals.”

The backend can normalize rule text into structured rule metadata.

Each rule becomes a reusable block with:

- Name
- Short label
- Hidden full context
- Severity
- Scope
- Tags
- Structured extraction

### 3. Save Rules as Reusable Blocks

Once a rule is written, the user should not need to rewrite it.

A rule can be saved as a reusable block. Later, the user can load it or drag it into a new plan. The backend injects the hidden context into planning prompts, while the UI only needs to show the compact label.

This creates “back blocks”: reusable context blocks for prompt injection.

### 4. Fill Meal Slots

For each empty meal slot, the user can ask for suggestions.

The backend calls `gpt-5-nano` with:

- Current week plan
- Active rules
- Saved preferences
- Selected day and meal slot
- Recent choices
- Optional pantry or ingredient context

The model returns structured suggestions, usually 3–4 options.

Example options:

- Air fryer salmon with green beans
- Chicken salad bowl
- Mushroom omelette
- Tofu lettuce wraps

The frontend renders these as buttons or cards.

### 5. Detect Rule Breaks

The app checks the plan against active rules.

Example:

A low-carb rule is active, but Wednesday dinner includes rice. The app shows:

> Low-carb warning: this meal includes rice. Use a small portion or choose a lower-carb alternative.

Actions:

- Use a very small portion
- Replace with cauliflower rice
- Move this dish to lunch
- Ignore this warning once

Rule-breaking should be visible but not annoying. Users can accept exceptions.

### 6. Complete the Week

The final plan should show:

- All planned lunches and dinners
- Rule status per day
- Fruit/vegetable count estimate
- Warnings and accepted exceptions
- Optional shopping list later

## Main UI: Weekly Schedule

The main screen should be a weekly planning grid.

Desktop layout:

```txt
+----------+----------+----------+----------+----------+----------+----------+
| Monday   | Tuesday  | Wednesday| Thursday | Friday   | Saturday | Sunday   |
+----------+----------+----------+----------+----------+----------+----------+
| Lunch    | Lunch    | Lunch    | Lunch    | Lunch    | Lunch    | Lunch    |
| Dinner   | Dinner   | Dinner   | Dinner   | Dinner   | Dinner   | Dinner   |
+----------+----------+----------+----------+----------+----------+----------+
```

Each day column should show:

- Day name
- Lunch card
- Dinner card
- Rule badges
- Fruit/vegetable count
- Warning badges

Mobile layout:

- One day card per section
- Lunch and dinner stacked
- Warnings below the relevant slot

## Interface Generation Model

The backend asks `gpt-5-nano` for strict JSON. The frontend renders only known component types.

Example response shape:

```json
{
  "type": "planner_response",
  "version": 1,
  "ui": [
    {
      "component": "choice_buttons",
      "props": {
        "question": "Pick a direction for Wednesday dinner:",
        "choices": [
          {
            "label": "Low-carb chicken bowl",
            "action": {
              "type": "select_meal_option",
              "payload": {
                "day": "wednesday",
                "slot": "dinner",
                "meal_id": "generated_chicken_bowl"
              }
            }
          },
          {
            "label": "Air fryer salmon and vegetables",
            "action": {
              "type": "select_meal_option",
              "payload": {
                "day": "wednesday",
                "slot": "dinner",
                "meal_id": "generated_salmon_veg"
              }
            }
          },
          {
            "label": "Mushroom omelette and salad",
            "action": {
              "type": "select_meal_option",
              "payload": {
                "day": "wednesday",
                "slot": "dinner",
                "meal_id": "generated_omelette_salad"
              }
            }
          }
        ]
      }
    }
  ],
  "warnings": [],
  "schedule_patch": null
}
```

## Supported UI Primitives

The first version should support these generated component types:

### `choice_buttons`

A question with 2–4 clickable options.

Use this for most LLM-guided progression.

### `meal_cards`

A set of suggested meals with metadata:

- Name
- Short description
- Main ingredients
- Estimated prep time
- Rule compatibility
- Warning count

### `rule_warning_cards`

Actionable warnings when meals conflict with rules.

Each warning should have buttons such as:

- Replace meal
- Adjust portion
- Accept exception
- Edit rule

### `form_fields`

Generated forms for structured user input.

Example:

- Budget
- Number of people
- Ingredients to use
- Ingredients to avoid
- Cooking equipment

### `ingredient_chips`

Clickable chips for selecting, removing, or confirming ingredients.

### `schedule_patch`

A structured update to the week plan.

Example:

```json
{
  "day": "friday",
  "slot": "dinner",
  "operation": "set_meal",
  "meal": {
    "name": "Turkey lettuce wraps",
    "ingredients": ["turkey", "lettuce", "cucumber", "yogurt sauce"],
    "tags": ["low_carb", "fast"]
  }
}
```

### `preference_block`

A reusable preference or rule block that can be saved and injected later.

### `next_step_panel`

A small panel suggesting what to do next.

Examples:

- Fill remaining dinners
- Check rule conflicts
- Generate shopping list
- Save this rule set

## Data Model

### Preferences

User-level defaults.

```sql
CREATE TABLE preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  household_size INTEGER,
  default_budget REAL,
  default_diet_style TEXT,
  locale TEXT DEFAULT 'en',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Rules

Reusable planning constraints.

```sql
CREATE TABLE rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  scope TEXT NOT NULL DEFAULT 'global',
  status TEXT NOT NULL DEFAULT 'active',
  tags_json TEXT,
  structured_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Reusable Blocks

Saved prompt-context blocks or reusable UI/context blocks.

```sql
CREATE TABLE reusable_blocks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  display_summary TEXT NOT NULL,
  hidden_context TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Meal Plans

The weekly plan.

```sql
CREATE TABLE meal_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  week_start_date TEXT NOT NULL,
  active_rules_json TEXT,
  plan_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Meals

Saved or generated meals.

```sql
CREATE TABLE meals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  ingredients_json TEXT,
  tags_json TEXT,
  nutrition_estimate_json TEXT,
  source TEXT DEFAULT 'generated',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Warnings

Rule conflicts linked to a plan.

```sql
CREATE TABLE warnings (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL,
  rule_id TEXT,
  day TEXT,
  slot TEXT,
  severity TEXT NOT NULL,
  message TEXT NOT NULL,
  actions_json TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Interface Templates

Reusable known UI patterns.

```sql
CREATE TABLE interface_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  component TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  default_props_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## API Plan

All API routes are served by the Cloudflare Worker.

### Health

```txt
GET /api/health
```

Returns basic backend status.

### Preferences

```txt
GET /api/preferences
PUT /api/preferences
```

Load and update user preferences.

### Rules

```txt
GET /api/rules
POST /api/rules
PUT /api/rules/:id
DELETE /api/rules/:id
POST /api/rules/normalize
```

`POST /api/rules/normalize` calls `gpt-5-nano` to transform raw rule text into structured rule metadata.

### Reusable Blocks

```txt
GET /api/blocks
POST /api/blocks
PUT /api/blocks/:id
DELETE /api/blocks/:id
```

These blocks are reusable hidden-context blocks for prompt injection and UI reuse.

### Plans

```txt
POST /api/plans
GET /api/plans/:id
PUT /api/plans/:id
DELETE /api/plans/:id
```

Create, load, update, and delete weekly plans.

### Planning Steps

```txt
POST /api/plans/:id/step
POST /api/plans/:id/suggest-options
POST /api/plans/:id/check-rules
```

These routes call the backend planning engine and may call `gpt-5-nano`.

### Interface Templates

```txt
GET /api/interface-templates
```

Returns reusable known interface templates.

## Backend Responsibilities

The Cloudflare Worker should:

1. Route API requests
2. Validate request payloads
3. Read/write D1 records
4. Load relevant rules and reusable blocks
5. Build compact prompts for `gpt-5-nano`
6. Call OpenAI from the backend only
7. Parse and validate JSON model responses
8. Return safe UI specs to the frontend
9. Provide fallback UI if the LLM response is invalid

The backend should never return arbitrary HTML from the LLM.

## Worker File Organization

Keep the backend in one file, but organize it clearly:

```txt
worker.js
  constants
  router
  CORS helpers
  JSON helpers
  database helpers
  validation helpers
  OpenAI helper
  prompt builders
  endpoint handlers
  fallback UI builders
```

## OpenAI Usage

All OpenAI calls happen in the Worker.

Environment variable:

```txt
OPENAI_API_KEY=...
```

Model:

```txt
gpt-5-nano
```

The model should be prompted to return strict JSON only.

Recommended backend behavior:

- Keep prompts compact
- Include only relevant active rules
- Include the current plan state
- Include selected day/slot if applicable
- Ask for 3–4 choices by default
- Ask for warnings when rules are broken
- Ask for known UI components only
- Reject invalid or unknown output

## Example Prompt Contract

System/developer instruction for planning calls:

```txt
You are a menu planning engine. Return strict JSON only. Do not return markdown. Do not return chat prose. Generate interface specs for a React app. Use only known components: choice_buttons, meal_cards, rule_warning_cards, form_fields, ingredient_chips, schedule_patch, preference_block, next_step_panel. Prefer 3 or 4 choices. Highlight conflicts with active rules. Every warning must include actionable choices.
```

User context payload:

```json
{
  "week_start_date": "2026-04-27",
  "selected_day": "wednesday",
  "selected_slot": "dinner",
  "active_rules": [
    {
      "name": "Low carb dinners",
      "severity": "warning",
      "text": "Prefer low-carb dinners on weekdays. Rice, pasta and bread should be avoided or kept very small."
    }
  ],
  "current_plan": {
    "monday": {
      "lunch": null,
      "dinner": null
    }
  }
}
```

## Rule-Breaking Examples

### Low Carb + Rice

If the plan includes rice while a low-carb rule is active, show a warning.

Suggested actions:

- Use a very small portion
- Replace rice with vegetables
- Move this meal to lunch
- Accept exception

### Five Fruits and Vegetables Per Day

If a day has too few fruits/vegetables, show a warning.

Suggested actions:

- Add fruit to lunch
- Add vegetable side to dinner
- Replace one meal
- Accept exception

### Avoided Ingredient

If a dish contains an avoided ingredient, show a hard conflict.

Suggested actions:

- Replace ingredient
- Replace meal
- Remove rule for this plan
- Accept exception once

## Frontend Responsibilities

The frontend should:

1. Render the weekly schedule
2. Display active rules
3. Display reusable blocks
4. Allow creating and editing rules
5. Call backend endpoints
6. Render generated interface specs using a whitelist
7. Apply schedule patches from backend responses
8. Show actionable warnings
9. Keep the user oriented with clear progress

## Suggested Frontend Structure

```txt
src/
  App.jsx
  main.jsx
  index.css
  api/
    client.js
  components/
    Layout.jsx
    WeekPlannerGrid.jsx
    DayColumn.jsx
    MealSlotCard.jsx
    RuleBadge.jsx
    WarningCard.jsx
    ChoiceButtons.jsx
    GeneratedForm.jsx
    MealOptionCard.jsx
    RuleBlockLibrary.jsx
    RuleEditor.jsx
    InterfaceRenderer.jsx
    EmptySlotCTA.jsx
  state/
    plannerReducer.js
  utils/
    dates.js
    validation.js
```

## Key Components

### `WeekPlannerGrid`

Shows the full weekly schedule.

Props:

- `plan`
- `warnings`
- `onSlotClick`
- `onMealEdit`
- `onCheckRules`

### `MealSlotCard`

Shows one lunch or dinner slot.

States:

- Empty
- Filled
- Has warning
- Has accepted exception

### `RuleBlockLibrary`

Shows saved reusable rules and context blocks.

Capabilities:

- Add block to current plan
- Remove block from current plan
- Expand to inspect hidden context
- Save new block

### `InterfaceRenderer`

Receives backend UI specs and renders only known components.

Unknown components should not crash the app.

### `WarningCard`

Shows rule conflict and actions.

Each warning must have at least one action.

## MVP Build Plan

### Phase 1 — Skeleton

- Create Vite React app
- Add TailwindCSS
- Build static layout
- Build 7-day, 2-meal grid
- Add mock plan state

### Phase 2 — Backend Worker

- Create Cloudflare Worker
- Add health endpoint
- Add CORS handling
- Add JSON routing helpers
- Add OpenAI helper using `OPENAI_API_KEY`
- Add mock planning endpoint

### Phase 3 — Persistence

- Add D1 database
- Create schema for rules, reusable blocks, plans, meals, warnings
- Implement CRUD routes for rules
- Implement create/load/update routes for meal plans

### Phase 4 — Rule Blocks

- Build rule editor
- Save rule to database
- Normalize rule through backend LLM call
- Show saved rules as compact blocks
- Allow activating/deactivating rules for a plan

### Phase 5 — Meal Suggestions

- Add `POST /api/plans/:id/suggest-options`
- Backend sends plan + active rules to `gpt-5-nano`
- Model returns 3–4 meal options as structured JSON
- Frontend renders options as cards/buttons
- User selects one option
- Meal is inserted into schedule

### Phase 6 — Rule Checking

- Add `POST /api/plans/:id/check-rules`
- Backend checks plan against active rules
- Use deterministic checks where possible
- Use LLM for semantic checks where helpful
- Return actionable warnings
- Render warnings in schedule and side panel

### Phase 7 — Interface Catalog

- Add interface template table or static catalog
- Load common UI patterns from catalog
- Use generated UI only when catalog templates are insufficient

### Phase 8 — Polish

- Improve responsive design
- Add empty states
- Add loading states
- Add retry/fallback behavior
- Add export/import JSON for plans and rules

## MVP Acceptance Criteria

The MVP is done when:

1. User can create a weekly plan
2. User can see a 7-day schedule with lunch and dinner
3. User can create and save rules
4. User can reuse saved rules
5. User can request meal options for a slot
6. Backend calls `gpt-5-nano`
7. The LLM returns structured JSON only
8. Frontend renders options as buttons/cards
9. User can select a meal and insert it into the week
10. App highlights rule-breaking situations
11. Warnings include actionable buttons
12. No OpenAI API key is exposed to the frontend
13. No raw LLM chat is displayed

## Nice-to-Have Features After MVP

- Shopping list generation
- Pantry inventory
- Recipe import from URLs
- Cost estimation
- Nutrition estimation
- Leftover planning
- Seasonal ingredient suggestions
- Multi-week planning
- Export to calendar
- Print-friendly weekly menu
- Household member preferences
- “Use what I already have” mode
- Local recipe library

## Design Direction

The app should feel:

- Clear
- Fast
- Practical
- Slightly playful
- Not medical
- Not overcomplicated
- More like a planning board than a chatbot

Suggested visual style:

- Soft cards
- Clear grid
- Rounded corners
- Badges for rules
- Warning colors for conflicts
- Compact action buttons
- Clean typography
- Mobile-first responsiveness

## Important Constraints

- Backend is the only place that calls OpenAI
- Backend should be a singular JavaScript Worker file
- LLM output must be validated
- Frontend must not render arbitrary HTML from the model
- User should usually get 3–4 choices, not open-ended text
- Rule blocks must be reusable
- Weekly schedule must remain the central visualization

## Future Product Idea

This project can become a general interface-generating planning system, where reusable context blocks and reusable UI blocks combine to guide the user through complex planning tasks without exposing the raw LLM interaction.

For this project, stay focused on weekly menus first.
