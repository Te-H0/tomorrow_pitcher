# Architecture Decisions

## Decisions To Lock Before Coding

1. All date and "today/tomorrow" logic uses KST.
2. Starter display priority is `ACTUAL > OFFICIAL_ANNOUNCED > SYSTEM_PREDICTED`.
3. Starter records are preserved by type. Official and actual starters never overwrite system predictions.
4. `starting_pitcher_records` current-row replacement must happen transactionally.
5. Vote writes go through Next.js Route Handlers only.
6. Vote API validates anonymous key format, game/team relationship, and pitcher/team eligibility.
7. KBO `/ws/` internal APIs are not used.
8. Crawler flow is `parse -> normalize -> validate -> upsert`.

## Schema Adjustments To Consider

The guide's base schema is good, but these changes are worth applying early:

- Add `outs_pitched integer` to appearance/stat records for calculation-safe inning handling.
- Keep display inning values separately if needed.
- Make games resilient to doubleheaders by prioritizing `kbo_game_id`; if missing, include `game_time` and `stadium` in the uniqueness strategy.
- Add an unresolved player mapping table or queue for crawler results that cannot be confidently matched.
- Add `last_synced_at` or equivalent source timestamps to records shown on major screens.

## API Shape

Prefer screen-ready aggregate responses:

- `GET /api/games?date=YYYY-MM-DD`
- `GET /api/games?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/games/[id]`
- `GET /api/games/[id]/votes`
- `POST /api/games/[id]/votes`

`GET /api/games/[id]` should return the game, teams, starter records by type, fan vote summary, rotations, and compact pitcher stats needed by the detail screen.

## Phase Order

1. Project scaffold.
2. Schema SQL, seed data, and environment conventions.
3. Seed-based home and game detail.
4. Rotation query and prediction logic.
5. Anonymous voting API and UI.
6. KBO GameCenter parser spike.
7. Calendar/team pages.
8. Crawler upserts and GitHub Actions.
9. Launch readiness.

