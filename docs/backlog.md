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

- [x] Decide MVP first screen scope: home as today's game report, with game detail as the core product surface.
- [x] Decide launch platform: pivot MVP frontend to Apps in Toss WebView mini app.
- [x] Decide MVP player photo policy: exclude real player photos until rights are secured.
- [ ] Decide initial admin workflow: Supabase Studio/import scripts first, or a minimal admin page.
- [ ] Decide first import range: 2026 full published schedule, or 2026 April-May first.
- [x] Decide prediction v1 scope: simple admin-managed rotation pointer only; defer rank-2 variable candidates.
- [x] Decide manual availability review semantics: KBO movement/news are admin context only in MVP v1, not automatic prediction mutation.
- [x] Decide rotation admin semantics: admins manage rotation order and current pointer after rainouts, skips, temporary starters, and manual corrections.
- [ ] Decide whether `starting_pitcher_records.confidence` is excluded from MVP schema or kept as an internal-only nullable field.
- [ ] Decide whether Toss Login is MVP day-one or post-business-registration follow-up.
- [ ] Decide immutable Apps in Toss `appName`, logo, and primary brand color for `야구일보`.
- [ ] Decide whether any Next.js app remains for admin/API or the MVP uses a separate lightweight server/API.

## Next Tasks

- [ ] Install Apps in Toss Codex skill from `toss/apps-in-toss-skills` path `apps-in-toss`.
- [ ] Optionally configure Apps in Toss MCP with `ax mcp start` on each development machine.
- [ ] Register or access Apps in Toss console workspace.
- [ ] Register business information in Apps in Toss console and track review status.
- [ ] Validate `야구일보` as the Apps in Toss Korean display name before console registration.
- [ ] Install Apps in Toss sandbox app and verify local dev server access from device.
- [ ] Scaffold `apps/mini-app` with Apps in Toss WebView tooling.
- [ ] Rework MVP UI design system around TDS Mobile and Apps in Toss floating tabbar constraints.
- [ ] Implement MVP bottom tabs: `홈`, `일정`, `커뮤니티`, `순위`.
- [ ] Build home as today's game report for the selected team.
- [ ] Build schedule as a monthly calendar that opens game detail.
- [ ] Build community MVP as admin-curated polls without comments.
- [ ] Build standings MVP with team rankings first.
- [ ] Write final Supabase SQL migration for confirmed pitcher-first schema.
- [ ] Add teams seed data with canonical service codes and KBO codes.
- [ ] Build KBO pitcher master/playerId import from pitcher record/detail pages.
- [ ] Build KBO schedule import from `Schedule.aspx`.
- [ ] Build KBO player availability import: use `Player/Register.aspx` for team/day registration and de-registration, then enrich relevant pitchers via `Player/Trade.aspx` player-name search.
- [ ] Build GameCenter starter and pitcher appearance import.
- [ ] Finalize DOM selector contract for `Schedule.aspx` status rows and GameCenter `PREVIEW` official starters.
- [ ] Use 23:10 KST only as a manual-test reminder for post-game actual starter verification; production scheduler should trigger from KBO game status checks.
- [ ] Generate sample local seed data from April-May 2026 KBO records.
- [ ] Continue 05.26~05.31 rotation-pointer prediction test: 05.27 actual starters and 05.28 official comparison are documented; next confirm 05.28 actual starters after games finish, then update 05.29~05.31 corrected predictions.
- [ ] Add `team_rotation_states` to final schema and seed one next-slot pointer per KBO team.
- [ ] Implement first rotation prediction service from `team_rotation_states.next_slot_no`.
- [ ] Build minimal admin workflow for team rotation order, current pointer, and manual prediction correction before advanced news/AI signals.
- [ ] Build minimal home and game detail views.

## Later

- [ ] Revisit player photos only after official permission or a paid license is available; model provider, source, scope, attribution, expiration, and removal status.
- [ ] Revisit hitter tables only when hitter/lineup features become real product scope.
- [ ] Revisit a generic `players` table only when cross-player features justify it.
- [ ] Revisit scheduled production import only after operational/legal/source policy is comfortable.
