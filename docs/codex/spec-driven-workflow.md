# Spec-Driven Workflow

## Goal

Work from agreed specs and plans instead of improvising feature-by-feature. This keeps product decisions, architecture decisions, and implementation tradeoffs visible over time.

## Document Types

### Feature Spec

Location: `docs/specs/`

Use for:

- User-facing behavior.
- Screen flow.
- MVP scope.
- Data states.
- Copy/terminology decisions.

### Development Plan

Location: `docs/dev-plans/`

Use for:

- Implementation sequence.
- Affected modules.
- API/schema changes.
- Tests and verification.
- Rollout risks.

### Decision Record

Location: `docs/decisions/`

Use for:

- Architecture choices.
- Product direction changes.
- Data modeling choices.
- Operational policies.
- Tradeoffs that future work should understand.

Manage decisions by meaningful topic, not by daily log. Use `YYYY-MM-DD-short-topic.md` filenames so they remain chronological without becoming progress notes.

### Progress Report

Location: `docs/progress/`

Use for:

- Completed work.
- Current blockers.
- Next tasks.
- Verification status.

## Workflow

1. Write or update the relevant spec.
2. Ask the user to confirm when product behavior, scope, data model, or workflow changes.
3. Write or update the development plan.
4. Implement against the plan.
5. Review against `AGENTS.md` and `docs/codex/engineering-standards.md`.
6. Record decisions made during implementation.
7. Update progress.

## When To Ask The User

Ask before proceeding when:

- MVP scope changes.
- A screen flow changes.
- A data model choice has long-term consequences.
- Any DB table boundary, relationship, enum/status model, or migration strategy is introduced or materially changed.
- An API contract that frontend or crawler code will depend on is introduced or materially changed.
- The implementation requires a new dependency.
- A shortcut would reduce maintainability.
- There are two reasonable paths with different product tradeoffs.

Do not ask for every small technical detail. Make conservative, maintainable choices when the answer is obvious from project rules.

## Confirmation Level

Use normal confirmation:

- Ask for product scope, DB schema, API contract, major UI flow, and operational policy decisions.
- Proceed without asking for small code organization, naming, component extraction, styling details within the design brief, and tests implied by the plan.
- If a small decision starts shaping future architecture, stop and ask.
