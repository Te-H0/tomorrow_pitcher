# Data Workspace

This folder stores temporary and project-owned data used while designing seed data, parser fixtures, and rotation logic.

## Current Files

- `2026-05-kbo-schedule.md`: May schedule table normalized from user-provided text.
- `2026-05-kbo-starters.md`: starter pitcher table extracted from KBO GameCenter via Playwright.

## Rules

- Data files should include the source/context when useful.
- Do not treat docs data as production seed data until it is parsed and reviewed.
- Keep official/system/fan/actual starter data separate when deriving data.
- If data becomes part of app seed or tests, move/copy it into the appropriate `supabase/seed`, `crawler/tests/fixtures`, or app fixture path later.
