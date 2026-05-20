# Engineering Standards

## Monorepo

Use this shape by default:

```text
apps/web
packages/shared
supabase
crawler
docs
.github/workflows
```

Keep app-specific code inside `apps/web`. Move only genuinely shared types, date helpers, constants, and pure domain logic into `packages/shared`.

## TypeScript

- Use `strict: true`.
- Avoid `any`; prefer `unknown` plus validation.
- Use explicit request/response DTOs for API routes.
- Use discriminated unions for starter record types and game statuses.
- Keep domain constants as typed objects, literal unions, or enums in one place.
- Do not pass important statuses as loose strings across layers.
- Prefer narrow domain types over generic `string`, `number`, or raw database values.
- Avoid large untyped JSON blobs crossing module boundaries.

Recommended domain enums/unions:

```ts
export const STARTER_RECORD_TYPES = {
  SYSTEM_PREDICTED: "SYSTEM_PREDICTED",
  OFFICIAL_ANNOUNCED: "OFFICIAL_ANNOUNCED",
  ACTUAL: "ACTUAL",
} as const;

export type StarterRecordType =
  (typeof STARTER_RECORD_TYPES)[keyof typeof STARTER_RECORD_TYPES];

export const GAME_STATUSES = {
  SCHEDULED: "SCHEDULED",
  ANNOUNCED: "ANNOUNCED",
  IN_PROGRESS: "IN_PROGRESS",
  FINISHED: "FINISHED",
  CANCELLED: "CANCELLED",
  POSTPONED: "POSTPONED",
} as const;

export type GameStatus = (typeof GAME_STATUSES)[keyof typeof GAME_STATUSES];
```

Use raw string literals only at the domain definition boundary, tests, or database mapping boundary.

## Domain Modeling

- Model domain concepts explicitly: game status, starter record type, vote candidate, pitcher eligibility, source, and sync status.
- Prefer named functions for state changes: `announceOfficialStarter`, `recordActualStarter`, `replaceCurrentStarterRecord`, `upsertStarterVote`.
- Avoid setter-style mutation that lets callers create invalid states.
- Keep invariants close to the domain operation.
- If a rule appears in two places, extract it before it drifts.
- Make invalid states difficult to represent with types and validation.
- Keep database rows separate from domain DTOs and screen DTOs.

## Maintainability Defaults

- Prefer boring, conventional architecture over clever abstractions.
- Keep modules cohesive and names domain-specific.
- Keep side effects at boundaries: route handlers, server repositories, crawler upserts, and UI event handlers.
- Keep pure logic pure when practical.
- Validate external input at the boundary and trust typed values internally.
- Prefer composition over large inheritance-like hierarchies.
- Do not let UI components own business rules.
- Do not let database schema details leak across the entire app.
- Avoid premature generic utilities; extract when at least two real use cases exist or the rule is business-critical.
- Write tests for rules that are easy to break: date/KST logic, vote eligibility, starter record replacement, rotation scoring, inning conversion, and crawler parsing.

## Documentation Discipline

- Meaningful product behavior starts from a spec.
- Meaningful implementation starts from a dev plan.
- Decisions that affect future maintenance go into `docs/decisions`.
- Keep docs updated as part of the change, not as a separate someday task.

## Next.js

- Use App Router.
- Prefer Server Components for data-loading pages.
- Use Client Components only for interactivity such as tabs, voting, localStorage anonymous key, and optimistic UI.
- Keep Route Handlers thin; move business logic to server modules.
- Do not import server-only modules into Client Components.
- Use `server-only` for modules that touch service-role clients or secrets.
- Treat `NEXT_PUBLIC_*` as public forever.

Suggested shape:

```text
apps/web/app
apps/web/components
apps/web/lib/server
apps/web/lib/client
apps/web/lib/domain
apps/web/types
```

## API

- Validate all inputs at the route boundary.
- Return screen-ready DTOs, not raw database rows.
- Keep `GET /api/games/[id]` aggregate enough for the detail screen.
- Make vote writes idempotent by `game_id + team_id + anonymous_key`.
- Validate that vote `teamId` belongs to the game.
- Validate that vote `pitcherId` is a pitcher for the selected team or an allowed candidate.
- Normalize all incoming date strings as KST dates.

## Supabase

- Store schema changes as SQL migrations in `supabase/migrations`.
- Keep seed data in `supabase/seed`.
- Generate or maintain typed database definitions before relying on them across the app.
- Use service role only in server/API/crawler contexts.
- Public read is acceptable for teams, games, players, starter records, and stats.
- Browser writes are not allowed.
- Write policies and RLS assumptions with the migration that introduces the table.

## Database

- Prefer stable external ids when available.
- Preserve raw crawler values when normalization is uncertain.
- Use `outs_pitched` for calculation-safe innings logic.
- Keep starter record types separate.
- Current starter record replacement should be transaction-safe.
- Add indexes with query patterns, not after performance issues appear.
- Design game identity for doubleheaders and schedule changes.
- Avoid textbook over-normalization. Do not split tables such as user/profile or entity/detail unless it solves a real query, lifecycle, permission, write-amplification, cardinality, audit/history, or maintenance problem.
- Prefer a pragmatic schema that fits MVP reads and operational updates.
- Keep schema proposals user-reviewed before migrations are written.
- In schema plans, explain why each table exists and why it is or is not split further.

## Frontend UX

- Build mobile first.
- Home and game detail come before calendar/team polish.
- Avoid marketing hero layouts.
- Use cards for individual games and repeated items, not for every section wrapper.
- Use compact status badges.
- Use team colors only as small accents.
- Always show data source and KST freshness where trust matters.
- Use `일치/다름`, not `적중/실패`, in user-facing comparison.

## Styling

- Tailwind is the default styling system.
- Prefer small reusable components over one large page file.
- Keep radii restrained: cards around `rounded-lg`, buttons around `rounded-md`.
- Use borders more than heavy shadows.
- Avoid one-note color palettes.
- Test mobile text overflow before considering UI done.

Suggested base palette:

```text
background #F8FAFC
surface #FFFFFF
muted surface #F1F5F9
text #0F172A
muted text #64748B
border #E2E8F0
primary #0F766E
primary soft #CCFBF1
warning #D97706
success #16A34A
danger #DC2626
```

## Crawler

- Keep crawler code under `crawler`.
- Use public HTML parsing.
- Do not use KBO `/ws/` internal endpoints.
- Split crawler flow into `parse`, `normalize`, `validate`, and `upsert`.
- Make mapping code explicit and testable.
- Store unresolved player/team values for admin review.
- Log source URL, collected time, and relevant raw text.
- Add saved sample HTML fixtures before relying on live pages in tests.

## Testing

Minimum useful coverage:

- Unit tests for KST date helpers.
- Unit tests for rotation prediction scoring.
- Unit tests for inning conversion.
- Route tests or integration tests for vote validation.
- Component tests or visual checks for home/game detail if the UI grows.
- Crawler parser tests against saved HTML fixtures.

## CI

Once scripts exist, CI should run:

```text
typecheck
lint
test
build
```

Crawler checks can be added separately once fixture-based parser tests exist.
