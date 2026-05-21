# Pitcher Domain Schema Notes

## Goal

Capture the MVP data model needed to support starter rotation prediction, official announced starters, actual starters, rainout handling, pitcher availability, and rotation slot replacement.

This is a planning note, not final SQL.

## Recommended MVP Tables

### `teams`

Generic team master.

### `pitchers`

Pitcher master and profile table.

The MVP does not use a generic `players` table. This avoids adding a common abstraction before the product needs hitter/player-wide features.

Suggested fields:

```text
team_id
kbo_player_id
name
jersey_number
birth_date
throws_hand
bats_hand
height_cm
weight_kg
position_text
career_text
draft_info
salary
is_active
source
```

Rules:

- `kbo_player_id` comes from KBO pitcher record/detail URLs such as `PitcherDetail/Basic.aspx?playerId=...`.
- GameCenter pitcher tables do not expose `playerId`; GameCenter records should match pitchers by `team + name` after pitcher masters are imported.
- If the service later needs hitter features, add `hitters` and hitter stat tables then. Reconsider a generic `players` table only when there is a real cross-player feature.

### `games`

Game schedule and status.

Important statuses:

```text
SCHEDULED
ANNOUNCED
IN_PROGRESS
FINISHED
CANCELLED
POSTPONED
SUSPENDED
```

### `starting_pitcher_records`

Stores starter information by type:

```text
SYSTEM_PREDICTED
OFFICIAL_ANNOUNCED
ACTUAL
```

Rules:

- Official announced starters do not overwrite system predictions.
- Actual starters do not get assumed from official announced starters.
- Cancelled games can have official announced starters but no actual starters.
- Normal games should have one `SYSTEM_PREDICTED` starter per team.
- Immediately after rainout/cancellation/postponement, `SYSTEM_PREDICTED` may store up to two ranked candidates per team.
- The second predicted candidate is only for cancellation uncertainty, not a general "top 2" feature.
- `OFFICIAL_ANNOUNCED` and `ACTUAL` remain single-pitcher records per game/team.

Suggested prediction fields:

```text
rank
confidence
reason_code
reason_text
```

Rank policy:

```text
rank = 1
primary expected starter

rank = 2
cancellation-uncertainty candidate only
```

Example:

```text
Rainout announced starter: A
Next actual/official starter: C
Next game prediction:
  rank 1: D, reason_code=ROTATION_AFTER_ACTUAL_START
  rank 2: A, reason_code=RAINOUT_CARRYOVER
```

### `pitcher_appearances`

Actual pitcher appearance history.

Rules:

- Rotation calculation primarily uses actual starter appearances.
- Cancelled games do not create pitcher appearances.
- Use `outs_pitched` for calculation-safe innings.

### `rotation_slots`

Team rotation structure.

Purpose:

- Represent 1st~5th/6th starter slots.
- Handle cases where a slot pitcher is injured, removed, or replaced.
- Let admin/import workflows correct the current rotation without rewriting appearance history.

Suggested fields:

```text
team_id
slot_no
pitcher_id
status
effective_from
effective_to
reason
source
note
```

Suggested status:

```text
ACTIVE
INACTIVE
TEMPORARY
```

Suggested reason:

```text
NORMAL
INJURY_REPLACEMENT
FARM_ASSIGNMENT
ROTATION_ADDED
ROTATION_REMOVED
REST_MANAGEMENT
PERFORMANCE
DOUBLEHEADER
UNKNOWN
```

Example:

```text
4th starter A injured
→ A slot row effective_to set
→ B inserted as active slot_no=4 with reason=INJURY_REPLACEMENT
```

### `pitcher_availability_events`

Pitcher availability and rotation-affecting events.

Purpose:

- Track why a pitcher should be excluded, downgraded, or treated as temporary.
- Avoid over-splitting into separate injury/farm/rotation event tables.

Suggested event types:

```text
INJURY
FARM_ASSIGNMENT
FIRST_TEAM_REGISTRATION
ROTATION_REMOVED
ROTATION_ADDED
TEMP_STARTER
BULLPEN_APPEARANCE
REST_MANAGEMENT
UNKNOWN
```

Suggested status:

```text
ACTIVE
RESOLVED
CANCELLED
```

### `pitcher_season_stats`

Pitcher stats for display and lightweight context.

Season stats are separated from `pitchers` because they change by season, team, and competition type.

Recommended MVP fields:

```text
season
team_id
pitcher_id
competition_type
era
games
starts
wins
losses
saves
holds
win_percentage
outs_pitched
batters_faced
pitch_count_total
hits_allowed
doubles_allowed
triples_allowed
home_runs_allowed
sacrifice_hits
sacrifice_flies
walks_allowed
intentional_walks
hit_by_pitch
strikeouts
wild_pitches
balks
runs
earned_runs
blown_saves
whip
opponent_avg
quality_starts
babip
pitches_per_game
pitches_per_inning
strikeouts_per_9
walks_per_9
strikeout_walk_ratio
opponent_obp
opponent_slg
opponent_ops
source
synced_at
```

Data source:

- `PitcherBasic/Basic1.aspx` for basic pitcher season stats.
- `PitcherBasic/Detail1.aspx` and `PitcherBasic/Detail2.aspx` for detailed season stats.
- `PitcherDetail/Basic.aspx?playerId=...` for player profile, current season, recent 10 games, and registration-day context.

### `starter_votes`

Anonymous fan expected starter votes.

## Why This Is Not Over-Normalized

`rotation_slots` and `pitcher_availability_events` are separate because they answer different questions:

- `rotation_slots`: who currently owns each team rotation slot?
- `pitcher_availability_events`: why is a pitcher unavailable, downgraded, temporary, or changed?

They are not split into many event subtype tables because MVP does not need that level of lifecycle separation.

## Prediction Flow

```text
1. Load recent actual starter appearances.
2. Load active rotation slots.
3. Load active pitcher availability events.
4. Load recent cancelled-game official announced starters as secondary signal.
5. Score candidates.
6. Store one SYSTEM_PREDICTED candidate for normal games.
7. Store a second SYSTEM_PREDICTED candidate only when recent cancellation uncertainty exists.
8. Replace display with OFFICIAL_ANNOUNCED when official starter is available.
9. Store ACTUAL only after real starter is known.
```

## Open Questions For Final Schema

- Should `rotation_slots.slot_no` support 6th starter explicitly or use `TEMPORARY` status?
- Should `pitcher_availability_events` allow team-level events without `pitcher_id`?
- Should source be a strict check constraint or free text during MVP?
- How much admin UI is needed versus Supabase Studio/import scripts?
