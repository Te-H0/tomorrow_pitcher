# MVP primary navigation

## Status

Accepted

## Date

2026-05-21

## Context

The product needs a clear mobile-first structure before UI implementation. The service should remain centered on KBO starter information while giving fans a reason to open it daily.

## Options

- Home as a generic game list with bottom tabs for home, calendar, and team.
- Home as today's game report, with separate tabs for schedule, community-style polls, and standings.
- Calendar-first experience where the month view is the main entry point.

## Decision

Use four primary bottom tabs for the MVP:

- `홈`: today's game reporting surface, centered on my team and KBO starter status.
- `일정`: monthly calendar schedule, with games opening the game detail view.
- `커뮤니티`: admin-curated poll surface, initially focused on simple two-option or bounded-choice baseball questions.
- `순위`: team standings first, with pitcher/player ranking views deferred until they support the starter-information product.

The game detail screen remains the core product surface. Home should summarize today's match context and route users into detail.

## Consequences

- Home is not a marketing page or generic schedule list; it should feel like a daily baseball report.
- The calendar can focus on browsing games by date without carrying all reporting content itself.
- Community scope stays intentionally narrow: polls, not free-form posts or comments in the MVP.
- Standings can support daily fan context, including later "rank movement scenario" features, without turning the service into a betting or prediction product.
