# Player photo policy

## Status

Accepted

## Date

2026-05-21

## Context

Player photos would improve visual appeal, but they create copyright, portrait-right, licensing, storage, attribution, expiration, and app-review risks. KBO, clubs, agencies, news outlets, and photographers can each hold rights depending on the photo source and use case.

## Options

- Crawl and store player photos from KBO, club, portal, or news pages.
- Hotlink external player photo URLs.
- Launch without player photos and use neutral baseball UI elements.
- Add player photos later after official permission or a paid license.

## Decision

Exclude player photos from the MVP.

The MVP should use:

- Player names.
- Team badges and small team-color accents.
- Jersey numbers if available from allowed data.
- Initials, neutral silhouettes, or pitcher-role icons.
- Starter status badges and matchup layout to provide visual hierarchy.

Do not crawl, store, hotlink, or AI-generate images that resemble real KBO players unless a later rights review explicitly approves the source and usage.

## Consequences

- MVP visual design must stand on typography, matchup layout, team accents, and TDS components rather than headshots.
- Future player-photo support requires a rights-managed asset model, including provider, source, license scope, attribution, expiration, and removal status.
- This reduces Apps in Toss review risk and avoids early operational burden.
