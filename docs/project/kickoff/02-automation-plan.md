# Automation Plan

## Development Automations

Set these up after the initial Next.js project and scripts exist:

- Type check: `npm run typecheck`
- Lint: `npm run lint`
- Unit tests: `npm test` or `npm run test`
- Build verification: `npm run build`
- Crawler smoke test: targeted Python command against saved sample HTML before touching live pages.

## Codex Automations

Useful recurring Codex jobs once the repo exists:

- Daily progress report: summarize changed files, completed checklist items, blockers, and next tasks.
- Pre-merge review: inspect changed files for security, KST/date logic, vote edge cases, and crawler rules.
- Crawler health check: review latest scheduled sync output and unresolved player mappings.

Do not create recurring automations yet because the project scripts, repo, and desired notification cadence are not defined.

## GitHub Actions

Add these in stages:

1. CI for typecheck, lint, tests, and build.
2. Scheduled seed/prediction verification if useful.
3. KBO sync workflows after crawler scripts are stable.

Recommended crawler workflows:

- Sync games: 09:00 and 13:00 KST.
- Generate pointer-based predictions: 15:00 KST, after any admin rotation updates.
- Sync official starters: 17:00, 18:00, 19:00, 21:00, 23:00, and next-day 10:00 KST.
- Sync actual starters: game-time and post-game windows.
- Sync pitcher stats: 01:00 KST.

GitHub Actions cron uses UTC, so convert KST times before committing workflow files.
