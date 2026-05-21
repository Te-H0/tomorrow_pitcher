# Mobile UI design system

## Status

Accepted

## Date

2026-05-21

## Context

The MVP needs a clear mobile visual direction before implementation. The selected reference uses a clean white bottom navigation bar, a large blue active tab, muted inactive icons, and simple icon-first navigation.

## Options

- Compact sports data board with teal accents.
- Team-color-heavy interface.
- Clean mobile utility style with a strong blue active state and restrained baseball accents.

## Decision

Use a clean mobile utility style:

- White and near-white surfaces.
- Strong blue primary color for active navigation and primary actions.
- Muted gray inactive icons and labels.
- Rounded active bottom-tab block with icon above label.
- Team colors only as small accents, chips, or matchup markers.

## Consequences

- The app should feel easy to open every day, not like a dense stats terminal.
- Bottom navigation becomes a major brand pattern and should stay consistent across MVP screens.
- Baseball-specific feeling should come from content hierarchy, starter states, team badges, schedule density, and matchup components rather than heavy team-color theming.
