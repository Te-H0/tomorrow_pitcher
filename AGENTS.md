# tomorrow_pitcher Codex Working Guide

## Identity

`tomorrow_pitcher` is a mobile-first KBO starter information service. It is not a betting, odds, match-result prediction, or gambling-adjacent product.

Product framing:

```text
KBO 경기 전 선발 정보 정리 서비스
```

The user-facing experience must help fans understand official announced starters, rotation-based expected starters, fan expectations, actual starters, recent rotations, and source freshness.

## Stack

Use this stack unless the user explicitly changes direction:

- Monorepo managed from this repository.
- Frontend: Next.js App Router, TypeScript strict, Tailwind CSS.
- API: Next.js Route Handlers.
- Database: Supabase Postgres.
- Local database: Supabase Local with Docker.
- Production database: Supabase Cloud.
- Server data access: Supabase service role only from server/API/crawler contexts.
- Crawler: Python, `requests`, BeautifulSoup4, Playwright only as fallback.
- Scheduler: GitHub Actions.
- Hosting: Vercel.

Recommended monorepo shape:

```text
apps/web
packages/shared
supabase
crawler
docs
.github/workflows
```

## Product Rules

- Treat game detail as the core product surface.
- Home is an entry point to today's and tomorrow's games, not a marketing landing page.
- Prefer `로테이션 예상`, `팬 예상`, `공식 예고`, `실제 선발`, `일치`, `다름`.
- Avoid `픽`, `승부`, `확률`, `수익`, `배당`, `보장`, `누적 적중률`, and betting-like copy.
- Show source and KST last-updated time on important data surfaces.
- When official announced starters exist, they take visual priority over rotation and fan expectations.

## Engineering Rules

- Keep TypeScript strict.
- Avoid `any`; use explicit DTOs/types for API responses.
- Do not scatter raw status strings through the codebase. Centralize domain states as typed constants, literal unions, or enums and reuse them.
- Prefer domain methods/functions that express intent over ad hoc property mutation.
- Keep state transitions explicit and reusable. For example, game status changes and starter-record current replacement should live in domain/server functions, not page components.
- Apply common production maintainability practices proactively, even when the user gives only examples: clear boundaries, cohesive modules, small functions, explicit domain language, stable API contracts, validation at boundaries, and tests around risky rules.
- Do not over-engineer abstractions before duplication or complexity is real, but do extract repeated business rules before they drift.
- Keep UI components presentational where practical.
- Put server-side business logic in `lib/server` or equivalent server-only modules.
- Put pure shared logic in `packages/shared` when it is used by multiple packages.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY`, crawler secrets, or server-only env vars to the browser.
- Browser writes go through API routes, never direct Supabase writes.
- Treat all date, "today", "tomorrow", schedule, and cron logic as `Asia/Seoul`.
- Do not call KBO `/ws/` internal API paths.
- Parse public HTML pages and keep crawler code isolated from the web app.
- Preserve starter record types. Never overwrite `SYSTEM_PREDICTED` with `OFFICIAL_ANNOUNCED` or `ACTUAL`.
- Do not assume actual starters match official announced starters.

## Data Rules

- Display priority is `ACTUAL > OFFICIAL_ANNOUNCED > SYSTEM_PREDICTED`.
- `starting_pitcher_records` current-row replacement must be transactional.
- Store unresolved or low-confidence crawler matches for review instead of silently guessing.
- Use calculation-safe innings representation such as `outs_pitched`; display text can be derived separately.
- Design `games` uniqueness to survive doubleheaders, reschedules, cancellations, and suspended games.
- Vote API must validate anonymous key format, game/team relationship, pitcher/team relationship, and pitcher eligibility.
- Do not over-normalize schemas just because a textbook model suggests it. Prefer pragmatic table boundaries based on query shape, MVP needs, write complexity, lifecycle, permissions, and maintenance cost.
- Major schema choices require user discussion and confirmation before implementation.

## UI Rules

- Mobile first.
- Use compact, scannable information density suitable for KBO fans.
- Use restrained color; team colors are accents, not full-page themes.
- Avoid card-in-card layouts.
- Build home, game detail, vote card, and rotation timeline before lower-priority screens.
- Always handle empty, loading, official-not-announced, cancelled, postponed, no-candidate, and sync-delay states.

## Agent Operating Rules

The main Codex thread is the orchestrator and integrator. Use subagents only for meaningful parallel analysis or isolated implementation slices.

Codex should not simply agree with the user. If another approach is safer, simpler, or more maintainable, explain the tradeoff and recommend it clearly.

This project is spec-driven. Before meaningful implementation, write or update the relevant plan/spec, get user confirmation when scope or product behavior changes, then implement against the agreed document.

Use normal confirmation: ask the user before product scope, DB schema, API contract, or major UI flow decisions; proceed independently on small implementation details that follow accepted specs.

Default roles:

- Product Planner: MVP scope, user flow, terminology, betting-risk review.
- Backend Architect: Supabase schema, RLS, API, server data access, KST rules.
- Frontend UX Designer: mobile UX, component system, information hierarchy.
- Data Crawler Engineer: KBO parsing, player matching, scheduler, crawler failure modes.
- Code Review Agent: maintainability, domain modeling, type safety, duplication, testability, and refactor risks.
- QA Release Reviewer: security, env leakage, date bugs, voting edge cases, launch checklist.

Parallelism guideline:

- Small question or one-file change: no subagent.
- Product or architecture decision: 2-3 subagents.
- Large design review: Product + Backend + Frontend.
- Implementation work: at most 2 workers with disjoint file ownership.
- Pre-release check: QA reviewer, optionally Backend reviewer.

## Required Review Checks

Before considering a meaningful change done, check:

- Does it preserve official/system/fan/actual starter separation?
- Does it keep service-role and crawler secrets server-only?
- Does it use KST consistently?
- Does it avoid betting-like language?
- Does it handle empty and delayed data states?
- Does it fit the MVP priority rather than expanding scope?
- Are important decisions recorded in the decision log or relevant spec?

## Repository Policy

- Keep project Codex files versioned in the repository.
- Do not add `.codex/` or Codex project-operation docs to `.gitignore`.
- Use local project skills and docs so work can continue consistently across machines and sessions.
- Project skill sources live in `.codex/skills/`. They are versioned with the repo. If a Codex environment does not auto-discover repo-local skills, install or copy them into `~/.codex/skills/` for global use.
- Keep current infrastructure and runtime architecture in `docs/architecture/`.
- Keep `MEMORY.md` short and durable. Use it for stable preferences and decisions, not detailed specs or temporary todos.
- Keep `CLAUDE.md` as a thin compatibility guide that points Claude Code to the same project rules.
- When a meaningful architecture, product, DB, API, environment, or workflow decision is made, update `docs/decisions/` and any relevant spec/plan/memory files without waiting for the user to ask.
- Use Conventional Commit-style English prefixes with Korean descriptions by default, such as `feat: 경기 상세 화면 추가`, `docs: 아키텍처 문서 추가`, or `chore: 개발 환경 설정`.
