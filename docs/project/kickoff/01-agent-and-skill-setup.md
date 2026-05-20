# Agent And Skill Setup

## Default Working Pattern

Use the main Codex thread as the integrator. Subagents should be used for focused, parallel opinions or isolated implementation slices.

## Subagent Lanes

### Product Planner

Responsibilities:

- Keep MVP scope tight.
- Check terminology for betting-like wording.
- Define launch readiness and user trust requirements.
- Review whether each feature supports the core pre-game starter-check flow.

Prompt starter:

```text
Review tomorrow_pitcher from a product/MVP perspective. Focus on scope, launch readiness, terminology, trust, and what can be deferred.
```

### Backend Architect

Responsibilities:

- Own Supabase schema, indexes, RLS assumptions, and API contracts.
- Guard service role boundaries.
- Design seed-first data access that can later be fed by crawlers.
- Review prediction record semantics.

Prompt starter:

```text
Review tomorrow_pitcher backend architecture. Focus on Supabase schema, Next.js route handlers, voting writes, prediction records, KST dates, and crawler handoff.
```

### Frontend Designer

Responsibilities:

- Own mobile-first UX and Tailwind component system.
- Prioritize home and game detail.
- Keep the interface dense enough for baseball fans without looking like a betting app.
- Check responsive layout and text overflow.

Prompt starter:

```text
Review tomorrow_pitcher mobile UX. Focus on home, game detail, vote interaction, calendar/team browsing, and a compact Tailwind design system.
```

### Crawler Engineer

Responsibilities:

- Own KBO HTML parsing strategy.
- Avoid `/ws/` internal APIs.
- Design id/name mapping and unresolved-player fallback.
- Add logging, retries, polite request pacing, and GitHub Actions entrypoints.

Prompt starter:

```text
Review tomorrow_pitcher crawler architecture. Focus on KBO HTML parsing, mapping, sync jobs, GitHub Actions schedules, and failure handling.
```

### QA Reviewer

Responsibilities:

- Review security, date handling, vote upsert edge cases, official/actual starter separation, and launch blockers.
- Check test gaps before merging larger slices.

Prompt starter:

```text
Review tomorrow_pitcher implementation for bugs, security risks, KST/date issues, Supabase service-role leakage, voting edge cases, and missing tests.
```

## Project Skills To Create Later

Create these as global Codex skills only after the repo structure exists and the workflow stabilizes:

- `tomorrow-pitcher-dev-plan`: converts product requests into scoped implementation plans.
- `tomorrow-pitcher-review`: reviews changes for service-role leakage, KST bugs, record-type separation, and KBO crawler rules.
- `tomorrow-pitcher-daily-report`: appends concise progress notes and next actions.
- `tomorrow-pitcher-crawler-check`: validates crawler changes against KBO public HTML parsing and scheduler rules.

Until then, keep this file and `AGENTS.md` as the operating source of truth.

