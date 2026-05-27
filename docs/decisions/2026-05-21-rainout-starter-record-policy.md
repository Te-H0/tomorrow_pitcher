# Rainout Starter Record Policy

## Status

Accepted

## Date

2026-05-21

## Context

KBO games can be cancelled after official announced starters are known. Some teams keep the same announced starter for the next game, while others move to the next rotation candidate. This affects rotation prediction and data modeling.

## Decision

- A cancelled game's official announced starters may be stored as `OFFICIAL_ANNOUNCED`.
- A cancelled game must not create `ACTUAL` starter records.
- A cancelled game must not create `pitcher_appearances`.
- Post-game sync must check KBO `Schedule.aspx` first and classify the game result/status before reading GameCenter pitcher records as actual appearances.
- Only games confirmed as played/finished should create `ACTUAL` starter records from GameCenter `REVIEW`.
- Games marked rainout, cancelled, postponed, no-game, or otherwise not official results must keep actual starter and pitcher appearance records empty.
- Rotation calculation should primarily use actual starter appearances.
- Recent cancelled-game announced starters may be used only as a secondary signal for the next prediction.
- Once a new official announced starter is published for the next game, that official record takes priority over system prediction.
- Normal games should show one system expected starter.
- The game immediately after rainout/cancellation/postponement may show up to two system candidates when the cancelled-game announced starter and actual rotation-next candidate differ.
- The second candidate is a cancellation-uncertainty candidate, not a general "top 2 predictions" product behavior.

Prediction display policy:

```text
Normal game before official announcement
→ show one expected starter

Game immediately after cancellation uncertainty
→ show primary expected starter
→ optionally show one variable candidate

After official announcement
→ show official announced starter first
```

Prediction storage policy:

```text
SYSTEM_PREDICTED rank=1
primary expected starter

SYSTEM_PREDICTED rank=2
only when rainout/cancellation carryover uncertainty exists

OFFICIAL_ANNOUNCED
single record per team/game

ACTUAL
single record per team/game after real appearance is known
```

## Consequences

- The system does not pollute actual rotation history with pitchers who never appeared.
- Rainout handling becomes explicit instead of hidden inside the rotation algorithm.
- UI should be able to explain that a prediction changed because official starters were re-announced after cancellation.
- The UI can express uncertainty without making every normal game look like a two-pitcher toss-up.

## MVP v1 Amendment

Accepted on 2026-05-22.

MVP v1 will keep prediction simpler than the full rainout variable-candidate model:

- The primary system prediction comes from the admin-managed rotation pointer.
- Rainouts, skipped starts, temporary starters, and manual corrections are handled by admin actions that hold, advance, or directly set the team's next pointer.
- `SYSTEM_PREDICTED rank=2` is deferred for MVP v1. It can be reintroduced later for rainout uncertainty or AI/operator variable candidates after the admin workflow is stable.
- AI/news processing is not allowed to automatically change predictions in MVP v1. It may later summarize starter-related news for operator review.

This amendment does not change the official/actual separation rules: cancelled games still do not create actual starter records or pitcher appearances, and official announced starters still display above system predictions.
