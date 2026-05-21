# Apps in Toss platform pivot

## Status

Accepted

## Date

2026-05-21

## Context

The product is now intended to launch as an Apps in Toss mini app instead of a standalone mobile web app first. This changes the frontend runtime, deployment path, design system constraints, local testing flow, and platform onboarding work.

Official Apps in Toss references checked on 2026-05-21:

- WebView mini apps can be scaffolded with `create-ait-app`.
- Non-game mini apps must use TDS.
- Apps in Toss provides WebView and React Native SDK paths; choose WebView for this MVP unless a later requirement forces React Native.
- Mini app bundles are uploaded to Apps in Toss/Toss for final testing and launch.
- Development uses a local dev server that the Apps in Toss sandbox app opens in a WebView.
- Tabs, navigation, brand color, logo, push/notification copy, and launch checks must follow Apps in Toss review guidelines.

## Decision

Pivot the MVP frontend from standalone Next.js/Vercel-first to an Apps in Toss WebView mini app.

Recommended stack:

- Frontend mini app: Apps in Toss WebView, scaffolded with `create-ait-app`.
- UI/design system: TDS Mobile and Apps in Toss branding/navigation/tabbar guidance.
- Local preview: browser for fast layout checks, Apps in Toss sandbox app for platform-real WebView checks.
- Data/backend: keep Supabase Postgres as the product database.
- Server/API boundary: re-evaluate Next.js Route Handlers; use a separate server/API layer only where needed for service-role access, Toss Login, mTLS server-to-server API calls, or crawler/admin operations.
- Crawler/import: keep isolated Playwright-rendered KBO public-page import scripts.
- Production hosting: Apps in Toss mini app bundle for frontend; Supabase Cloud and approved server/crawler hosting for backend/import jobs.

## Consequences

- The existing `apps/web` Next.js plan should be treated as deferred or repurposed for admin/backoffice only after confirmation.
- UI implementation must not assume arbitrary custom app navigation. TDS and Apps in Toss review constraints take priority.
- The previously accepted four MVP surfaces remain valid: `홈`, `일정`, `커뮤니티`, `순위`; their tabbar implementation must be adapted to Apps in Toss allowed floating tabbar style.
- App onboarding tasks now become part of the critical path: console/workspace setup, appName, brand name, logo, brand color, sandbox testing, and launch checklist.
- The user plans to register a business. This is recommended before building Toss Login, monetization, promotion/business wallet, and operational push workflows.
