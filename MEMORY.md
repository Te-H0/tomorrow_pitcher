# Project Memory

This file stores durable project preferences and decisions that should survive across Codex, Claude Code, and other AI coding sessions.

Keep this file short. Put detailed rules in `AGENTS.md`, `docs/codex/`, and `docs/decisions/`.

## Management Rules

- Keep this file under 120 lines.
- Add only stable preferences, durable decisions, and repeated corrections that future sessions must remember.
- Do not add temporary todos, daily progress, implementation notes, command outputs, or one-off observations.
- Put detailed rationale in `docs/decisions/` and link/summarize here only if it changes future behavior.
- Put work status in `docs/progress/`, not here.
- If a new memory duplicates `AGENTS.md` or `docs/codex/`, either skip it or replace the older wording with a shorter pointer.
- Review and prune this file after major milestones or when it approaches 100 lines.
- Prefer editing existing bullets over appending similar new bullets.

## Stable Preferences

- Use normal confirmation: ask before product scope, DB schema, API contract, major UI flow, or operational policy changes.
- Prefer maintainable, domain-oriented code over quick stringly-typed implementations.
- Do not scatter raw status strings. Centralize domain states as typed constants, literal unions, or enums.
- Prefer named domain operations over setter-style mutation.
- Avoid textbook over-normalized database schemas. Split tables only when lifecycle, permissions, cardinality, query shape, audit/history, write complexity, or maintenance value justify it.
- Codex should push back when a safer or more maintainable option exists.
- Keep `.codex/` project files versioned; do not add them to `.gitignore`.
- If repo-local skills in `.codex/skills/` are not auto-discovered on another machine, install/copy them to `~/.codex/skills/`.
- Use English Conventional Commit prefixes with Korean descriptions by default, for example `feat: ...`, `docs: ...`, `chore: ...`.

## Product Decisions

- Product framing: KBO 경기 전 선발 정보 정리 서비스.
- Avoid betting, odds, profit, guaranteed prediction, or gambling-adjacent language.
- Game detail is the core product surface.
- Home should quickly show today/tomorrow starter status.
- Official announced starters visually outrank rotation/fan expectations once available.

## Technical Decisions

- Monorepo from this repository.
- Stack: Next.js App Router, TypeScript strict, Tailwind CSS, Supabase Postgres, Next.js Route Handlers, Python crawler, GitHub Actions, Vercel.
- Development DB uses Supabase Local with Docker; production DB uses Supabase Cloud.
- Treat all schedule and "today/tomorrow" logic as `Asia/Seoul`.
- Do not use KBO `/ws/` internal API paths.
- Keep official, system, fan, and actual starter data separate.

## Working Style

- For meaningful work: spec -> user confirmation when needed -> dev plan -> implementation -> review -> decision/progress update.
- For small obvious fixes: proceed directly and report what changed.
- Use subagents selectively for product, backend, frontend, crawler, code review, and QA perspectives.
