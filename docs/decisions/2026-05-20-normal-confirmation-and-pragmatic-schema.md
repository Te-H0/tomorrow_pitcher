# Normal Confirmation And Pragmatic Schema

## Status

Accepted

## Context

The project should move quickly, but major product and data-model decisions should not be made silently. The user prefers maintainable, pragmatic schemas over overly academic normalization.

## Decision

Use normal confirmation:

- Ask before product scope changes.
- Ask before DB schema/table boundary decisions.
- Ask before API contracts that frontend or crawler code will depend on.
- Ask before major UI flow changes.
- Proceed independently on small implementation details that follow accepted specs.

Use pragmatic schema design:

- Do not split tables just because a normalized textbook model suggests it.
- Split only when there is a real lifecycle, permission, cardinality, query, audit/history, write-complexity, or maintenance reason.
- In DB plans, explain the reason for each table and notable non-splits.

## Consequences

- DB design remains collaborative.
- Implementation can still move without asking for every small detail.
- Schema proposals should include tradeoffs, not only final SQL.
