# System Overview

## Product Shape

`tomorrow_pitcher` is a mobile-first KBO starter information service.

Core user flow:

```text
Home today's/tomorrow's games
→ Game detail
→ Admin-managed rotation expectation
→ Fan expectation vote
→ Official announced starter
→ Actual starter record
```

## Runtime Architecture

```text
User
  ↓
Toss App / Apps in Toss WebView mini app
  ↓
Server/API boundary where needed
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
apps/mini-app
  Apps in Toss WebView mini app, TDS Mobile UI, platform configuration

apps/web or apps/admin
  Deferred unless needed for admin/backoffice or server/API routes

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
- Team rotation states.
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

Mini app WebView:

- Reads public data through approved API/server boundaries.
- Stores only safe client preferences or anonymous local keys if used.
- Never receives service-role keys.

Server/API layer:

- Reads and aggregates Supabase data.
- Handles vote writes.
- Owns server-side validation.
- Owns any service-role Supabase access.
- Owns Apps in Toss server-to-server calls that require mTLS certificates.

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
| Player registration status | `https://www.koreabaseball.com/Player/Register.aspx` | Import team/day registration and de-registration as the primary admin availability signal |
| Player movement details | `https://www.koreabaseball.com/Player/Trade.aspx` | Search by player name to enrich registration/de-registration with movement reason, injury list, rehabilitation, waiver, and notes |

## Prediction Model

MVP v1 predictions are intentionally simple and operator-controlled:

```text
Admin manages team rotation order
→ team_rotation_states.next_slot_no marks the next starter slot
→ prediction job writes one SYSTEM_PREDICTED rank=1 record
→ official announced starters display above system predictions
→ actual starters are stored only after real appearances
```

Rainouts, skipped starts, temporary starters, and manual corrections are handled by admin actions that hold, advance, or directly set the team pointer. AI/news processing may later summarize starter-related news for operators, but must not automatically mutate prediction records in MVP v1.

KBO player availability should be collected in two layers:

```text
Register.aspx team/day registration table
→ decide whether the pitcher is currently registered or de-registered
Trade.aspx player-name search
→ attach detailed context such as injury list, rehabilitation list, waiver, military hold, or registration note
→ show as admin context only
```

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
- Apps in Toss/TDS platform constraints override standalone web UI assumptions.
- Do not expose service-role credentials or Apps in Toss server certificates to the WebView client.
- Do not over-normalize tables without product or operational value.
- MVP data modeling is pitcher-first; hitter/lineup expansion is deferred.
- Keep domain constants centralized.
- Keep business rules outside UI components.
- Keep raw DB rows, domain objects, and screen DTOs separate when boundaries matter.
