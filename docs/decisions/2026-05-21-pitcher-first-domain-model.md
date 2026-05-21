# Pitcher First Domain Model

## Status

Accepted

## Date

2026-05-21

## Context

The MVP is a starter rotation service. Most product value comes from managing pitcher data: actual starts, official announced starters, system predictions, pitcher availability, rainout effects, and rotation replacement logic.

The service may later expand to hitters, lineups, or broader game previews, but those are not MVP concerns.

## Decision

Use a pitcher-first domain model for MVP.

Core pitcher domain tables should cover:

- Pitcher master/profile data.
- Actual pitcher appearances.
- Starter records by type.
- Team rotation slots.
- Pitcher availability events.
- Pitcher season stats.
- Starter votes.

Defer hitter-specific tables and broad player/game analytics until a later expansion.

Do not create a generic `players` table for MVP. Use `pitchers` directly because the product is pitcher-first and KBO pitcher data has its own source pages and stat shape. If hitter/player-wide features become real product requirements, add `hitters` and reconsider a shared player abstraction then.

## Domain Boundaries

Pitcher-related records:

- `pitchers`: pitcher master/profile data and KBO `playerId`.
- `pitcher_appearances`: actual appearances and actual starter history.
- `starting_pitcher_records`: system prediction, official announced starter, actual starter.
- `rotation_slots`: current team rotation structure such as 1st~5th starter and replacements.
- `pitcher_availability_events`: injury, farm assignment, rotation removal/addition, temporary starter, rest management.
- `pitcher_season_stats`: pitcher stats by season/team/competition type used for display and context.
- `starter_votes`: fan expected starter votes.

Generic records:

- `teams`
- `games`

Deferred records:

- Hitter stats.
- Lineups.
- Batter appearances.
- Full box score modeling beyond the minimum needed for starter rotation.

## Consequences

- MVP schema stays aligned with the product's actual value.
- Rotation replacement cases are modelable without over-normalizing every possible baseball event.
- Admin/import workflows can focus on pitcher data first.
- Future hitter or lineup features can be added as separate modules without polluting MVP tables.
