# Design Brief

## UI Principle

The service should feel like a compact baseball information board, not a betting or prediction product.

Users should understand the starter state within a few seconds:

```text
date/time -> stadium -> matchup -> starter status -> rotation/fan/official info
```

## First Screen

Use home as today's game report. It should summarize the current KBO day with the user's selected team first, then link into game detail:

```text
App bar: 선발일보 / current KST date / selected team
Today report
My team game card
Starter status summary
Poll preview
Bottom tabs: 홈 / 일정 / 커뮤니티 / 순위
```

Keep the tagline small. The report content is the hero.

Primary MVP tabs:

- `홈`: today's game report.
- `일정`: monthly calendar schedule.
- `커뮤니티`: admin-curated polls.
- `순위`: team standings first.

## Game Card

Recommended compact structure:

```text
잠실 18:30 · 공식 전
LG 임찬규 72  vs  두산 곽빈 68
팬 예상 LG 임찬규 54% · 두산 최원준 41%
```

The full card can navigate to detail. Put the primary vote interaction in the detail screen.

## Game Detail

The detail page is the product center. Start with a matchup-style starter board, then show state-specific content.

Official-before state:

```text
공식 발표 전
로테이션 예상
팬 예상
최근 로테이션
투수 간단 기록
```

Official-after state:

```text
공식 예고
공식 발표와 로테이션/팬 예상 비교
최근 로테이션
투수 간단 기록
```

Use `일치/다름`, not `적중/불일치`, for user-facing comparison.

## Voting

Use team-separated option lists. Always show current percentages.

```text
LG 팬 예상
○ 임찬규 54%
○ 치리노스 23%
○ 손주영 12%
```

After voting, show `내 선택: 임찬규`. Re-selecting another option updates the vote.

Avoid free-text "other" in the first MVP because it hurts data quality.

## Visual System

Suggested Tailwind tokens:

```text
background: #F7F9FC
surface: #FFFFFF
surface muted: #F1F4F8
text: #111827
muted text: #8A94A6
subtle text: #B7BEC9
border: #E6EAF0
primary: #1E73F8
primary pressed: #155BD4
primary soft: #EAF2FF
warning: #D97706
success: #16A34A
danger: #DC2626
```

Use team colors only in small badges, thin accents, or chips. Do not let team colors become the full-page theme.

### Bottom Navigation

Use the attached reference direction for the mobile footer:

```text
White fixed bottom bar
4 tabs: 홈 / 일정 / 커뮤니티 / 순위
Active tab: blue rounded rectangle, white icon, white label
Inactive tabs: gray icon, gray label
Icon above label
Large tap targets
```

Recommended icon mapping:

- `홈`: home icon.
- `일정`: calendar icon.
- `커뮤니티`: vote, message-circle, or chart-pie icon.
- `순위`: bar-chart or trophy icon.

The active tab block should feel prominent but not pill-like navigation clutter. Keep the footer height stable across all screens.

Core components:

- `GameStatusBadge`
- `TeamBadge`
- `GameCard`
- `StarterMatchup`
- `VoteOption`
- `RotationTimeline`
- `StatPill`
- `BottomTabBar`
- `DateSegmentControl`
