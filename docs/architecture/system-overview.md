# System Overview

## Product Shape

`tomorrow_pitcher` is a mobile-first KBO starter information service.

Core user flow:

```text
Home today's/tomorrow's games
→ Game detail
→ Rotation-based starter expectation
→ Fan expectation vote
→ Official announced starter
→ Actual starter record
```

## Runtime Architecture

```text
User
  ↓
Vercel / Next.js App Router
  ↓
Next.js Route Handlers
  ↓
Supabase Cloud Postgres

GitHub Actions cron
  ↓
Python crawler
  ↓
KBO public HTML pages
  ↓
Supabase Cloud Postgres
```

## Monorepo Shape

Planned structure:

```text
apps/web
  Next.js app, route handlers, UI components

packages/shared
  shared domain constants, KST date helpers, pure rules, shared types

supabase
  migrations, seed data, generated database types

crawler
  Python KBO parsers, mappers, sync scripts, parser fixtures/tests

docs
  specs, dev plans, architecture, decisions, progress

.github/workflows
  CI and scheduled crawler workflows
```

## Data Ownership

Supabase is the source of truth for:

- Teams.
- Players.
- Games.
- Pitcher appearances.
- Starter records.
- Fan votes.
- Pitcher season stats.

Starter record types must stay separate:

```text
SYSTEM_PREDICTED
OFFICIAL_ANNOUNCED
ACTUAL
```

Display priority:

```text
ACTUAL > OFFICIAL_ANNOUNCED > SYSTEM_PREDICTED
```

## Server Boundaries

Browser:

- Reads public data through pages/API.
- Creates anonymous vote key in localStorage.
- Never receives service-role keys.

Next.js server/API:

- Reads and aggregates Supabase data.
- Handles vote writes.
- Owns server-side validation.

Crawler:

- Parses KBO public HTML.
- Normalizes and validates data.
- Upserts into Supabase using service-role credentials.
- Does not call KBO `/ws/` internal APIs.

## Crawler Data Flow

```text
Fetch public HTML
→ Parse
→ Normalize
→ Validate
→ Map teams/players
→ Upsert
→ Log unresolved values
```

Parser and mapping tests should be fixture-based where possible.

## Architecture Rules

- All schedule and "today/tomorrow" logic is KST.
- DB schema decisions require user confirmation.
- Do not over-normalize tables without product or operational value.
- Keep domain constants centralized.
- Keep business rules outside UI components.
- Keep raw DB rows, domain objects, and screen DTOs separate when boundaries matter.

