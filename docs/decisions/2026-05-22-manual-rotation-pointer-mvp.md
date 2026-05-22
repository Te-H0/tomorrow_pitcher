# Manual Rotation Pointer MVP

## Status

Accepted

## Date

2026-05-22

## Context

KBO starter prediction has many real-world exceptions: rainouts, skipped starts, injury news, de-registration, temporary starters, bullpen games, and manager comments. Trying to encode every exception in server rules or an AI-driven automatic replacement system would make the MVP brittle.

The product still needs useful pre-game starter expectations before official starters are announced. The safest MVP path is to make the base prediction deterministic and operator-controllable.

## Decision

MVP v1 uses an admin-managed team rotation pointer as the source for system predictions.

- `rotation_slots` stores each team's managed starter order.
- `team_rotation_states` stores the team's current next-slot pointer.
- The prediction service reads `team_rotation_states.next_slot_no`, resolves the matching active `rotation_slots` row, and writes one `SYSTEM_PREDICTED rank=1` record per game/team.
- Admins can manually adjust rotation order, hold/advance/set the pointer, and make one-game manual corrections when baseball exceptions occur.
- KBO official announced starters and actual starters remain separate records and display above system predictions.
- KBO player movement data such as registration, de-registration, injury list, and rehabilitation list should be collected as admin context.
- AI/news processing is deferred from automatic prediction changes. If used in early versions, AI should summarize starter-related news for the operator, not mutate prediction records.

`team_rotation_states` is expected to have one row per team. This small row count is intentional because it stores shared operational state, not historical event data.

## Non-Goals

- No automatic injury/news classification that changes rank 1 predictions in MVP v1.
- No score-based starter selection model in MVP v1.
- No general "top 2 prediction" behavior in MVP v1.
- No attempt to perfectly infer every temporary starter or skipped start from code.

## Admin Behavior

For each team, admins should be able to:

- View and edit the rotation order.
- Set the next slot directly.
- Advance the pointer after an actual starter.
- Hold the pointer after a rainout/cancellation.
- Choose whether a temporary starter should advance the rotation or leave the pointer unchanged.
- Enter notes explaining manual changes.

## Data Implications

Minimum state table:

```text
team_rotation_states
- team_id
- next_slot_no
- updated_by
- updated_at
- note
```

Useful later fields:

```text
last_advanced_game_id
last_actual_starter_id
manual_override_until
```

`last_advanced_game_id` can prevent double-advancing the same game. `last_actual_starter_id` explains which actual starter informed the pointer move. `manual_override_until` can protect an operator-managed period from automation.

## Consequences

- The prediction engine stays simple and explainable.
- Operators keep control over ambiguous KBO exceptions.
- AI can be introduced later as an operator assistant without becoming the source of truth.
- The service schema remains aligned with existing official/system/actual starter separation.
