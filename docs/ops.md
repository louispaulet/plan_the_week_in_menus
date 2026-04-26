# Operations Guide

This project deploys directly from `main` to Cloudflare Workers with Cloudflare D1.

## One-Time Setup

Install dependencies:

```bash
make install
```

Log in to Cloudflare:

```bash
npx wrangler login
```

Create the D1 database:

```bash
make db-create
```

Wrangler prints a `database_id`. Put that value in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "week-menu-planner"
database_id = "the-id-from-wrangler"
migrations_dir = "migrations"
```

Set the OpenAI secret on Cloudflare:

```bash
npx wrangler secret put OPENAI_API_KEY
```

## D1 Migrations

Create a new migration:

```bash
npx wrangler d1 migrations create week-menu-planner migration_name
```

Apply migrations locally:

```bash
make db-migrate-local
```

Equivalent raw command:

```bash
npx wrangler d1 migrations apply week-menu-planner --local
```

Apply migrations remotely:

```bash
make db-migrate-remote
```

Equivalent raw command:

```bash
npx wrangler d1 migrations apply week-menu-planner --remote
```

Inspect local data:

```bash
npx wrangler d1 execute week-menu-planner --local --command="SELECT name FROM sqlite_master WHERE type = 'table';"
```

Inspect remote data:

```bash
npx wrangler d1 execute week-menu-planner --remote --command="SELECT name FROM sqlite_master WHERE type = 'table';"
```

## Local Development

Run the React frontend:

```bash
make up
```

Run the Worker with local D1:

```bash
make worker
```

The Vite dev server proxies `/api` calls to the local Worker at `http://127.0.0.1:8787`.

## Build, Test, Deploy

Build the frontend:

```bash
make build
```

Run smoke tests:

```bash
make test
```

Deploy frontend assets and Worker:

```bash
make deploy
```

Equivalent raw command:

```bash
npm run build && npx wrangler deploy
```

Check git status:

```bash
make status
```

## API Smoke Checks

Local health check:

```bash
curl http://127.0.0.1:8787/api/health
```

Create a rule:

```bash
curl -X POST http://127.0.0.1:8787/api/rules \
  -H "content-type: application/json" \
  -d '{"name":"Low carb dinners","text":"Keep weekday dinners low carb.","severity":"warning","scope":"meal"}'
```

List rules:

```bash
curl http://127.0.0.1:8787/api/rules
```

Create a plan:

```bash
curl -X POST http://127.0.0.1:8787/api/plans \
  -H "content-type: application/json" \
  -d '{"title":"This week","week_start_date":"2026-04-27","active_rules_json":[],"plan_json":{}}'
```

## Git Workflow

This project works directly on `main`:

```bash
git status --short --branch
git add .
git commit -m "Describe the completed milestone"
git push origin main
```

Do not create feature branches or pull requests unless the project workflow changes.
