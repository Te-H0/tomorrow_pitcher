# Codex Operating Manual

## Purpose

Use Codex as a small project team, not just a code generator. The main thread owns judgment and integration. Subagents provide focused opinions or isolated work when that genuinely helps.

Codex should behave like a technical partner. It should push back when the requested approach increases risk, weakens maintainability, expands MVP scope unnecessarily, or conflicts with the project rules.

The project uses a spec-driven workflow. Plans, product decisions, architecture decisions, and scope changes should be captured before implementation when they meaningfully affect the product or codebase.

## Role System

### Main Orchestrator

Use for:

- Final decisions.
- Implementation.
- Integrating subagent feedback.
- Keeping scope under control.

### Product Planner

Use for:

- MVP scope cuts.
- User flow decisions.
- Copy and terminology.
- Betting/gambling-risk review.
- Data trust and launch criteria.

### Backend Architect

Use for:

- Supabase schema.
- RLS and service-role boundaries.
- Route Handler contracts.
- Vote upsert rules.
- Starter record semantics.
- KST date behavior.

### Frontend UX Designer

Use for:

- Mobile-first layout.
- Home/game detail hierarchy.
- Vote interaction.
- Tailwind component system.
- Responsive and text-overflow risks.

### Data Crawler Engineer

Use for:

- KBO public HTML parsing.
- Player/team mapping.
- Sync job boundaries.
- GitHub Actions cron conversion.
- Failure logging and recovery.

### Code Review Agent

Use for:

- Maintainability review.
- Domain modeling review.
- Type-safety review.
- Duplicate logic and abstraction review.
- Testability review.
- Checking that statuses, record types, and transitions are centralized.
- Reviewing whether implementation choices will age well.

### QA Release Reviewer

Use for:

- Pre-merge or pre-release review.
- Env/security leak checks.
- Date/time and vote edge cases.
- Regression risk.
- Launch checklist.

## When To Use Subagents

Use no subagent for:

- Simple answers.
- Small edits.
- Single-file fixes.
- Commands with obvious outputs.

Use 2-3 subagents for:

- MVP scope choices.
- Architecture direction.
- Design direction.
- Large cross-cutting changes.

Use at most 2 implementation workers when:

- File ownership can be clearly separated.
- The tasks can proceed in parallel.
- The main thread can review and integrate the result.

## Default Parallel Patterns

Product decision:

```text
Product Planner + Frontend UX Designer
```

Schema/API decision:

```text
Backend Architect + QA Release Reviewer
```

Maintainability review:

```text
Code Review Agent
```

First major feature plan:

```text
Product Planner + Backend Architect + Frontend UX Designer
```

Crawler work:

```text
Data Crawler Engineer + Backend Architect
```

Release readiness:

```text
QA Release Reviewer + Product Planner
```

## Skill Strategy

Project-local skill sources live in `.codex/skills`. Install them globally only when they prove useful in normal development.

When moving machines, cloning the repo preserves the skill sources. If the local Codex environment does not auto-discover repo-local skills, install or copy `.codex/skills/*` into `~/.codex/skills/` to make them globally available.

Initial skills:

- `tomorrow-pitcher-plan`
- `tomorrow-pitcher-review`
- `tomorrow-pitcher-report`
- `tomorrow-pitcher-crawler-check`

Use skills when the task is repeated often enough that the same checklist would otherwise be rewritten.

## Spec-Driven Workflow

Use this flow for non-trivial work:

1. Capture the request.
2. Classify it as product, architecture, UI, crawler, QA, or maintenance.
3. Draft or update the relevant spec/plan.
4. Record decisions and open questions.
5. Ask for user confirmation when scope, UX, data model, or operational behavior changes.
6. Implement only after the direction is clear.
7. Review against the spec.
8. Update the decision log and progress report.

Skip the formal spec only for tiny fixes, obvious command outputs, typo fixes, or purely mechanical edits.

## Documentation System

Use:

- `docs/architecture/` for current system, infrastructure, runtime, and environment architecture.
- `docs/specs/` for feature specs and product behavior.
- `docs/dev-plans/` for implementation plans.
- `docs/decisions/` for architecture/product decisions.
- `docs/progress/` for running reports.

Decision records should be short and topic-based. Prefer useful history over ceremony. Do not use decisions as daily logs.

Codex should update decision records proactively. If a conversation settles a meaningful architecture, product, DB, API, environment, or workflow decision, record it in `docs/decisions/` and update `MEMORY.md` only when the decision should affect future sessions.

## Memory Hygiene

Use `MEMORY.md` only for durable, cross-session preferences and decisions. Keep it under 120 lines. Do not store todos, command logs, daily progress, or implementation scratch notes there. Prune or consolidate it after major milestones.

## Git Conventions

Write commit messages in Korean by default. Use another language only when the user explicitly asks for it.

## Core References

Use these local files as the project operating source:

- `AGENTS.md`
- `MEMORY.md`
- `CLAUDE.md`
- `docs/codex/engineering-standards.md`
- `docs/architecture/system-overview.md`
- `docs/architecture/environments.md`
- `docs/project/kickoff/00-startup-analysis.md`
- `docs/project/kickoff/03-architecture-decisions.md`
- `docs/project/kickoff/04-design-brief.md`
- `docs/project/kickoff/05-launch-checklist.md`
