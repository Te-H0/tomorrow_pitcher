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

Admin/import workflow
  ↓
Playwright-rendered KBO public pages
  ↓
Supabase Cloud Postgres / Local Supabase
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

scripts
  KBO Playwright import scripts, mappers, parser fixtures/tests

docs
  specs, dev plans, architecture, decisions, progress

.github/workflows
  CI and scheduled crawler workflows
```

## Data Ownership

Supabase is the source of truth for:

- Teams.
- Pitchers.
- Games.
- Pitcher appearances.
- Starter records.
- Rotation slots.
- Pitcher availability events.
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

Import scripts:

- Parse KBO public pages rendered through Playwright.
- Normalizes and validates data.
- Upserts into Supabase using service-role credentials.
- Does not call KBO `/ws/` internal APIs.

## Data Sources

The initial canonical data source is KBO public pages. Imports should keep internal IDs separate from external IDs.

| Data | KBO page | Initial use |
| --- | --- | --- |
| Game schedule | `https://www.koreabaseball.com/Schedule/Schedule.aspx#` | Pre-register published games into `games` before prediction |
| GameCenter starters and pitcher records | `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx` | Import official announced starters, actual starters, and pitcher appearances |
| Pitcher records and player IDs | `https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx` | Import pitcher masters, KBO `playerId`, and season stats |
| Pitcher detail | `https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx?playerId=...` | Import pitcher profile, detail stats, recent game context, and registration-day context |
| Player movement | `https://www.koreabaseball.com/Player/Trade.aspx` | Candidate source for injury/registration/transfer context; exact mapping is deferred |

## Import Data Flow

```text
Open KBO public page with Playwright
→ Read rendered DOM
→ Parse target fields
→ Normalize
→ Validate
→ Map teams/pitchers
→ Upsert
→ Log unresolved values
```

Parser and mapping tests should be fixture-based where possible.

## Architecture Rules

- All schedule and "today/tomorrow" logic is KST.
- DB schema decisions require user confirmation.
- Do not over-normalize tables without product or operational value.
- MVP data modeling is pitcher-first; hitter/lineup expansion is deferred.
- Keep domain constants centralized.
- Keep business rules outside UI components.
- Keep raw DB rows, domain objects, and screen DTOs separate when boundaries matter.
