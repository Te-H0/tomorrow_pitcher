# Apps in Toss Readiness Plan

## Goal

Prepare `tomorrow_pitcher` to develop and launch as an Apps in Toss WebView mini app.

## Confirmed Direction

- Launch target: Apps in Toss mini app.
- Working Korean brand/display name: `야구일보`.
- MVP frontend: WebView mini app, not standalone Next.js-first.
- UI system: TDS Mobile with Apps in Toss navigation, branding, and tabbar constraints.
- Core product surfaces remain: `홈`, `일정`, `커뮤니티`, `순위`.
- Product must still avoid betting-like language and preserve starter-data separation.

## User/Console Prerequisites

The user should prepare these before or during early development:

- Create or access an Apps in Toss console workspace.
- Register business information, since the user plans to use platform features and operate the service seriously.
- Decide app name, `appName`, Korean display name, logo, and primary brand color.
- Prepare customer support email, phone/contact, and chat/support URL if required by console registration.
- Install the Apps in Toss sandbox app for real-device testing.
- Set up Apps in Toss AI support locally: install Apps in Toss Codex skill and optionally MCP via `ax mcp start`.

## Business Registration Notes

Official docs say business registration is not required for every basic mini app use, and some features such as push/notifications can exist without business registration. However, business registration is required or strongly tied to important operational features such as Toss Login, in-app ads, in-app payment, Toss Pay, promotions, business wallet, and settlement workflows.

Because this project plans notifications and likely needs stable user identity/operations, use business registration as an early prerequisite.

Known review timing from official docs:

- Business information review: about 1-2 business days.
- Settlement information review, when needed: about 2-3 business days.
- App information review can take about 1-2 business days.
- Launch review is separate and includes operations, design, functionality, and security checks.

## Brand Registration Draft

- Korean display name: `야구일보`.
- Product meaning: a daily KBO baseball report centered on starter information, schedule, polls, and standings.
- `appName`: not decided. Choose carefully before console registration because it is used as the immutable mini app identifier and deep link key.
- Logo: not decided.
- Primary brand color: not decided; must fit Apps in Toss brand color requirements and TDS usage.

## Local Development Flow

```text
Run local dev server
→ quick browser check at localhost
→ open from Apps in Toss sandbox app on a real device
→ build mini app bundle
→ upload/test through Toss app before release request
```

For real-device sandbox testing, the local dev server must be reachable from the device, so the dev server usually needs a LAN host setting.

## Technical Plan

1. Install Apps in Toss Codex skill from `toss/apps-in-toss-skills` path `apps-in-toss`.
2. Add or scaffold an Apps in Toss WebView app in the monorepo.
3. Rework architecture docs from `Vercel / Next.js App Router` to `Apps in Toss WebView + Supabase + server-only API where needed`.
4. Redefine UI design system around TDS Mobile.
5. Reinterpret MVP tabbar using Apps in Toss floating tabbar constraints.
6. Decide whether Next.js remains for admin/API or is removed from MVP.
7. Implement `홈`, `일정`, `커뮤니티`, `순위` screens with seeded data first.
8. Verify in browser and Apps in Toss sandbox.

## Open Questions

- Will the MVP use Toss Login from day one, or start with anonymous/team preference storage and add Toss Login after console approval?
- Which server layer will own service-role Supabase access for vote writes and admin/crawler operations?
- What is the immutable `appName` for `야구일보`?
- What exact Apps in Toss floating tabbar component/pattern should be used in code?
