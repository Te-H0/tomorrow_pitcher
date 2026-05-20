# Design Brief

## UI Principle

The service should feel like a compact baseball information board, not a betting or prediction product.

Users should understand the starter state within a few seconds:

```text
date/time -> stadium -> matchup -> starter status -> rotation/fan/official info
```

## First Screen

Use home as the fast lookup screen:

```text
App bar: 선발일보 / current KST date
Date segmented control: 오늘 / 내일 / 이번 주
Game cards
Bottom tabs: 홈 / 달력 / 팀
```

Keep the tagline small. The game list is the hero.

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
background: #F8FAFC
surface: #FFFFFF
surface muted: #F1F5F9
text: #0F172A
muted text: #64748B
border: #E2E8F0
primary: #0F766E
primary soft: #CCFBF1
warning: #D97706
success: #16A34A
danger: #DC2626
```

Use team colors only in small badges, thin accents, or chips.

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

