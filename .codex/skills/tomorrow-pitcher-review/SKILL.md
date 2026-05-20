---
name: tomorrow-pitcher-review
description: Review tomorrow_pitcher changes for production risks. Use when Codex is asked to review code, PRs, diffs, schema changes, API routes, crawler changes, frontend UI, or launch readiness in the KBO starter information monorepo.
---

# tomorrow-pitcher Review

## Review Stance

Prioritize bugs, security issues, data corruption risks, user confusion, and missing tests. Findings come first, ordered by severity, with file and line references when available.

## Required Checks

- `SUPABASE_SERVICE_ROLE_KEY` and crawler secrets are server-only.
- Browser writes do not bypass API routes.
- Important statuses and record types are centralized as typed constants, literal unions, or enums instead of loose strings.
- Domain operations use named methods/functions instead of scattered setter-style mutation.
- Duplicate rules are extracted before they drift.
- Raw database rows are not leaked directly into UI contracts when a stable DTO is needed.
- Schema changes are not over-normalized without a real lifecycle, query, permission, cardinality, audit/history, write-complexity, or maintenance reason.
- Major DB/API decisions were documented and user-confirmed.
- KST date logic is explicit and consistent.
- `ACTUAL`, `OFFICIAL_ANNOUNCED`, `SYSTEM_PREDICTED`, and fan vote data are not mixed.
- Official announced starters do not overwrite system predictions.
- Actual starters are not assumed from official starters.
- Vote writes validate anonymous key, game/team relationship, pitcher/team relationship, and eligibility.
- KBO `/ws/` internal APIs are not called.
- Crawler parsing failures are logged and do not silently corrupt data.
- UI avoids betting-like copy.
- Empty, loading, cancelled, postponed, no-candidate, and sync-delay states are handled where relevant.

## Schema-Specific Checks

- Current starter record replacement is transactional.
- Game identity handles doubleheaders/reschedules where possible.
- Innings calculations do not treat baseball `.1` and `.2` as decimal fractions.
- Unmatched player data is preserved for review.

## Output Shape

Use:

- Findings.
- Open questions or assumptions.
- Test gaps.
- Brief summary only after findings.
