# Maintainability Defaults

## Status

Accepted

## Context

The project has business rules that can drift easily: game status, starter record types, KST dates, vote eligibility, official/system/fan/actual starter separation, and crawler mapping.

## Decision

Use maintainability-first defaults:

- Centralize domain statuses and record types as typed constants, literal unions, or enums.
- Avoid loose status strings throughout the codebase.
- Prefer named domain operations over setter-style mutation.
- Keep database rows, domain objects, and screen DTOs separate when boundaries matter.
- Avoid over-normalized database designs that add joins and lifecycle complexity without real product benefit.
- Review major schema boundaries with the user before implementation.
- Validate external input at boundaries.
- Keep business rules outside UI components.
- Extract repeated business rules before they drift.
- Test fragile domain rules.

## Consequences

- Initial implementation may be slightly more deliberate.
- Future changes should be safer and easier to review.
- Code review should challenge clever shortcuts that weaken the domain model.
