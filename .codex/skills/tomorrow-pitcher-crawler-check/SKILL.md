---
name: tomorrow-pitcher-crawler-check
description: Review or plan tomorrow_pitcher crawler and scheduled sync work. Use for KBO GameCenter parsing, pitcher records parsing, player/team mapping, Supabase upserts, GitHub Actions schedules, crawler failures, or data freshness checks.
---

# tomorrow-pitcher Crawler Check

## Rules

- Do not use KBO `/ws/` internal API paths.
- Parse public HTML pages.
- Keep crawler code isolated from the Next.js app.
- Use `parse -> normalize -> validate -> upsert`.
- Store raw or unresolved values when matching is uncertain.
- Log failures with enough context to debug later.
- Use polite request pacing and clear User-Agent.
- Convert GitHub Actions cron from KST to UTC.
- For post-game sync, check KBO `Schedule.aspx` before GameCenter `REVIEW`.
- Do not treat GameCenter pitcher rows as actual starters until the schedule page confirms the game produced an official result.
- Rainout, cancelled, postponed, or no-game rows must not write `ACTUAL` starter records or pitcher appearances.

## Required Checks

- Team mapping is explicit.
- Player matching prefers stable KBO ids when available.
- Name-only matching handles ambiguity.
- Unmatched players do not get silently mapped to the wrong person.
- Schedule result/status is checked before actual starter import.
- Official starters write `OFFICIAL_ANNOUNCED`.
- Actual starters write `ACTUAL` and update starter appearances.
- System predictions are not overwritten by crawler results.
- Sync output includes source and collected time.

## Output Shape

Return:

- Target source/page.
- Data fields.
- Parse strategy.
- Mapping strategy.
- Upsert strategy.
- Failure modes.
- Verification plan.
