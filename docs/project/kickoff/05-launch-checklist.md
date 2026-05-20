# Launch Checklist

## P0 Product

- Home shows today/tomorrow games quickly.
- Game detail clearly separates official, rotation, fan, and actual starter data.
- Official announced starters take visual priority once available.
- Fan voting works without login and allows vote changes.
- Data source and KST last-updated time are visible on important screens.
- Empty states exist for official-not-announced, no games, no candidates, sync delay, cancelled, and postponed games.

## P0 Engineering

- Supabase service role key is never exposed to the browser.
- RLS and write boundaries are documented before real data writes.
- Vote API validates game/team/pitcher relationships.
- Starter record writes preserve type history and current-row consistency.
- KST helper is used consistently.
- Crawler does not use KBO `/ws/` internal APIs.
- GitHub Actions schedules are converted from KST to UTC.

## P1 After First Usable MVP

- Calendar screen.
- Team screen.
- Actual starter automation.
- Full system/fan/official comparison.
- Expanded pitcher stats.

