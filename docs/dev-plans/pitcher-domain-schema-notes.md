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
- GameCenter REVIEW pitcher tables show name only, but the GameCenter **date page** `li.game-cont` attributes expose `away_p_id`/`home_p_id` = KBO `playerId` for both preview and actual starters (confirmed 2026-07-18). Prefer that playerId; fall back to `team + name` matching where absent.
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
- MVP v1 should store one `SYSTEM_PREDICTED` starter per team from the managed rotation pointer.
- A second `SYSTEM_PREDICTED` candidate is deferred for MVP v1. It may be revisited later for rainout uncertainty or AI/operator variable candidates.
- AI/news signals must not automatically replace the primary system prediction in MVP v1.
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
primary expected starter from managed rotation

rank = 2
deferred for MVP v1; future variable candidate only when product policy allows it
```

Future non-MVP example:

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

- Represent each team's managed starter order, usually 1st~5th/6th slots.
- Let admins correct the rotation order without rewriting appearance history.
- Keep the long-term rotation structure separate from the current "next starter" pointer.

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

For MVP v1, avoid automatic slot replacement from news or uncertain injury reports. Operators can update `rotation_slots` manually when they decide the team's rotation structure really changed.

### `team_rotation_states`

Current rotation pointer per team.

Purpose:

- Store which active `rotation_slots.slot_no` should be used for the team's next system prediction.
- Let an admin move, hold, or directly set the next starter pointer after rainouts, skips, temporary starters, or manual corrections.
- Prevent the prediction service from inferring every KBO exception from code.

Expected row count is one row per KBO team. A small state table is intentional because this is shared operational state used by admin workflows and prediction jobs.

Suggested fields:

```text
team_id
next_slot_no
last_advanced_game_id
last_actual_starter_id
manual_override_until
updated_by
updated_at
note
```

MVP minimum fields:

```text
team_id
next_slot_no
updated_by
updated_at
note
```

Admin actions:

```text
Set next slot directly
Advance to next slot
Hold pointer after rainout/cancellation
Move pointer after actual starter
Mark one-game manual prediction without changing the long-term slot order
```

### `pitcher_availability_events`

Pitcher availability and rotation-affecting events.

Purpose:

- Track official or manually recorded availability facts such as KBO registration, de-registration, injury list, rehabilitation list, or operator notes.
- Use KBO `Player/Register.aspx` as the primary source for team/day registration and de-registration status.
- Use KBO `Player/Trade.aspx` player-name search as a detail source for movement reason, injury list, rehabilitation list, waiver, military hold, and notes.
- Serve as admin context for manual rotation/pointer decisions in MVP v1.
- Avoid over-splitting into separate injury/farm/rotation event tables.
- Do not automatically change `rotation_slots`, `team_rotation_states`, or `starting_pitcher_records` in MVP v1.

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

`rotation_slots`, `team_rotation_states`, and `pitcher_availability_events` are separate because they answer different questions:

- `rotation_slots`: who currently owns each team rotation slot?
- `team_rotation_states`: which slot is next for this team's managed rotation?
- `pitcher_availability_events`: what official/manual context might affect operator decisions?

They are not split into many event subtype tables because MVP does not need that level of lifecycle separation.

## Prediction Flow

```text
1. Load upcoming games.
2. For each team, load `team_rotation_states.next_slot_no`.
3. Resolve the active `rotation_slots` row for that slot.
4. Store one `SYSTEM_PREDICTED` rank=1 record for that game/team.
5. Keep KBO registration/de-registration and movement-detail events as admin context, not automatic replacement logic.
6. Let admins adjust rotation order, next pointer, or one-game manual corrections when needed.
7. Display `OFFICIAL_ANNOUNCED` over `SYSTEM_PREDICTED` when official starters are available.
8. Store `ACTUAL` only after the real starter appearance is known.
9. Advance or hold the team pointer based on actual starter/cancellation policy and admin choice.
```

## Open Questions For Final Schema

- Should `rotation_slots.slot_no` support 6th starter explicitly or use `TEMPORARY` status?
- Should one-game manual prediction overrides live only in `starting_pitcher_records`, or have a small admin audit table?
- Should `pitcher_availability_events` allow team-level events without `pitcher_id`?
- Should source be a strict check constraint or free text during MVP?
- Should MVP admin be a minimal page or Supabase Studio/import scripts first?
