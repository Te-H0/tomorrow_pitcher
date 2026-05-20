---
name: tomorrow-pitcher-plan
description: Plan tomorrow_pitcher feature work before implementation. Use when Codex needs to scope a new feature, API, schema change, crawler task, UI flow, or refactor for the KBO starter information monorepo, with MVP discipline, Supabase/Next.js architecture, KST dates, and betting-safe product constraints.
---

# tomorrow-pitcher Plan

## Workflow

1. Identify the requested change and whether it is P0, P1, or deferrable.
2. Check product fit: does it improve pre-game starter lookup, game detail clarity, voting, official status, or data trust?
3. Choose the affected areas: `apps/web`, `packages/shared`, `supabase`, `crawler`, `.github/workflows`, or docs.
4. Design data flow before UI details.
5. Call out KST, service-role, RLS, and starter-record implications.
6. Produce a small implementation sequence with verification steps.

## Default Architecture

- Next.js App Router and Route Handlers.
- TypeScript strict.
- Tailwind CSS.
- Supabase Postgres.
- Python crawler isolated under `crawler`.
- GitHub Actions for scheduled sync.

## Planning Constraints

- Home and game detail outrank secondary pages.
- Seed-based working product outranks full crawler automation.
- Official, system, fan, and actual starter data must stay separate.
- All date logic is KST.
- Browser writes must go through API routes.
- Avoid betting-like wording and prediction-accuracy gamification.
- Major DB schema, API contract, product scope, and major UI flow choices require user confirmation.
- Avoid textbook over-normalization; justify each table boundary by lifecycle, query shape, permissions, cardinality, audit/history, write complexity, or maintenance value.

## Output Shape

Return:

- Goal.
- Scope decision.
- Affected files/modules.
- Data/API design.
- Schema tradeoffs and table-boundary rationale when relevant.
- UI impact if relevant.
- Risks.
- Step-by-step implementation plan.
- Verification checklist.
