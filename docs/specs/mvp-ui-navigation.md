# MVP UI Navigation Spec

## Goal

Define the first mobile UI structure for `tomorrow_pitcher`: a compact KBO starter-information service that fans can check daily.

## Primary Tabs

### 홈

Purpose: today's game report.

Show a compact reporting feed for today's KBO context, prioritizing the user's selected team after login.

MVP content:

- My team today's game, if scheduled.
- Matchup, stadium, KST game time, and game state.
- Starter status: `공식 예고`, `로테이션 예상`, `팬 예상`, and eventually `실제 선발`.
- Source and KST last-updated time for starter data.
- Link to the game detail screen.
- Today's admin-curated poll preview when available.

Empty states:

- No game today.
- Official starter not announced yet.
- Data sync delayed.
- User has not selected a team.

### 일정

Purpose: browse games by date.

Use a monthly calendar as the main surface. Each game date should show compact team matchup text such as `vs 두산` or `@ 삼성` from the selected team's perspective when a team is selected.

Tapping a game opens the game detail screen.

MVP content:

- Month navigation.
- My team schedule emphasis after team selection.
- Today's date highlight.
- Game state markers for cancelled, postponed, or completed games.

### 커뮤니티

Purpose: lightweight fan participation through polls.

Use admin-curated polls instead of free-form community posts in the MVP.

MVP content:

- Today's poll.
- Two-option or bounded-choice poll questions.
- Vote percentages after voting.
- Clear `내 선택` state.

Constraints:

- No comments in MVP.
- No free-text answers in MVP.
- Avoid betting-like copy such as `픽`, `승부`, `확률`, `수익`, `배당`, `보장`, and `적중률`.

### 순위

Purpose: provide baseball context fans commonly check.

Start with team standings. Personal/player rankings are deferred unless they directly strengthen the starter-information experience.

MVP content:

- KBO team standings.
- Team rank, games behind, wins/losses/draws, and winning percentage if available.
- My team highlight after team selection.

Post-MVP candidates:

- Rank movement scenario: "오늘 우리 팀이 이기고 경쟁 팀이 지면 순위가 바뀔 수 있음."
- Starter-focused pitcher rankings.
- Recent starter rotation form by team.

## Game Detail Relationship

Game detail remains the core product surface and can be reached from home or schedule.

It should show:

- Matchup, date, stadium, and KST time.
- Official announced starters when available.
- Rotation-based expected starters when official starters are not yet available.
- Fan expectation results.
- Actual starters after the game data exists.
- Recent rotation timeline.
- Data source and KST last-updated time.

## Player Image Policy

Do not show real player photos in the MVP.

Use safe alternatives:

- Player name and team.
- Jersey number when available from allowed data.
- Team badge or small team-color accent.
- Initials, neutral silhouette, or pitcher-role icon.

Do not crawl, store, hotlink, or AI-generate real-player-like images without an approved license or explicit rights review.

## Bottom Navigation Design

Use a fixed mobile footer with four icon-first tabs:

- `홈`
- `일정`
- `커뮤니티`
- `순위`

Visual behavior:

- Active tab uses a large blue rounded rectangle.
- Active icon and label are white.
- Inactive icons and labels are muted gray.
- Icon sits above the label.
- Each tab has a stable tap target and does not resize when the active state changes.
- Footer background is white with a subtle top border or shadow.

Suggested icon mapping:

- `홈`: home.
- `일정`: calendar.
- `커뮤니티`: poll/vote/message-style icon.
- `순위`: chart or trophy.

## Acceptance Criteria

- Bottom navigation contains `홈`, `일정`, `커뮤니티`, and `순위`.
- Bottom navigation follows the accepted blue active-tab reference style.
- Home is designed as a daily report, not a landing page.
- Schedule uses a monthly calendar as the main browsing surface.
- Community MVP is polls only.
- Standings start with team rankings.
- MVP does not include real player photos.
- All starter states preserve the separation between official, system-predicted, fan-expected, and actual starters.
- UI copy avoids betting-like language.
