# Backlog

This file tracks open questions, pending decisions, and next tasks that should not be lost between AI coding sessions.

## Rules

- Add items here when a question or task remains after discussion.
- Keep items short and actionable.
- Move accepted long-term decisions into `docs/decisions/`.
- Move detailed implementation plans into `docs/dev-plans/`.
- Move completed work summaries into `docs/progress/`.
- Do not use this as a daily log.

## Pending Decisions

- [ ] Decide MVP first screen scope: home only, or home plus game detail.
- [ ] Decide initial admin workflow: Supabase Studio/import scripts first, or a minimal admin page.
- [ ] Decide first import range: 2026 full published schedule, or 2026 April-May first.
- [ ] Decide prediction v1 scope: simple rotation only, or include cancellation variable candidate from the first version.
- [ ] Decide whether `starting_pitcher_records.confidence` is excluded from MVP schema or kept as an internal-only nullable field.

## Next Tasks

- [ ] Write final Supabase SQL migration for confirmed pitcher-first schema.
- [ ] Add teams seed data with canonical service codes and KBO codes.
- [ ] Build KBO pitcher master/playerId import from pitcher record/detail pages.
- [ ] Build KBO schedule import from `Schedule.aspx`.
- [ ] Build GameCenter starter and pitcher appearance import.
- [ ] Generate sample local seed data from April-May 2026 KBO records.
- [ ] Implement first rotation prediction service.
- [ ] Build minimal home and game detail views.

## Later

- [ ] Revisit hitter tables only when hitter/lineup features become real product scope.
- [ ] Revisit a generic `players` table only when cross-player features justify it.
- [ ] Revisit scheduled production import only after operational/legal/source policy is comfortable.
