# Decisions

Use this folder for meaningful product, architecture, data, workflow, and operational decisions.

## Style

Use decision records by topic, not daily logs. Daily work belongs in `docs/progress/`.

Recommended filename:

```text
YYYY-MM-DD-short-topic.md
```

Examples:

```text
2026-05-20-codex-project-operation.md
2026-05-20-pragmatic-schema-policy.md
2026-05-25-starter-record-model.md
```

## When To Add A Decision

Add a decision record when:

- DB schema/table boundaries are chosen.
- API contracts are fixed.
- Product scope changes.
- A major UI flow is accepted.
- A new dependency is introduced.
- A crawler or data-source policy is chosen.
- A tradeoff will matter to future maintenance.

Do not add a decision for:

- Daily progress.
- Minor implementation details.
- Mechanical refactors.
- Temporary todos.

## Template

```md
# Decision title

## Status

Proposed | Accepted | Superseded

## Date

YYYY-MM-DD

## Context

What problem or tradeoff led to this decision?

## Options

- Option A
- Option B

## Decision

What did we choose?

## Consequences

What gets easier, harder, or constrained?
```

