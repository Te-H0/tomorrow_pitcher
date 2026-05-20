# Startup Analysis

## Current State

- Workspace: `/Users/teho/Desktop/tom_pit`
- Current repository state: empty directory, not yet a git repository.
- Source plan: `/Users/teho/Downloads/tomorrow_pitcher_final_dev_guide.md`
- Product direction: mobile-first KBO starter rotation checker with system predictions, fan voting, official starter confirmation, actual starter records, and recent rotations.

## My Take

The plan is strong because it has a crisp user pain: fans currently calculate rotations manually. The biggest risk is not UI complexity; it is data reliability and the order of implementation.

The MVP should not start with crawling. Start with schema, seeds, and a fully working product loop. Once the screens and APIs prove the shape, add KBO sync and scheduled jobs. That keeps crawling uncertainty from blocking the product.

## Recommended MVP Cut

Keep for MVP:

- Today/tomorrow game list.
- Game detail with system prediction, fan vote, official status, and recent rotations.
- Anonymous voting with local `anonymous_key`.
- Seed-based teams, pitchers, games, appearances, predictions, and stats.
- Supabase schema and route handlers that match the future crawler.
- Data source and last-updated display.
- Empty/error states for official-not-announced, cancelled/postponed, no candidates, and sync delay.
- One minimal KBO GameCenter parser spike before full crawler automation.

Defer until after first usable MVP:

- Full player registry crawler.
- Full calendar and team pages if the first slice needs to stay lean.
- Rich pitcher profile page polish.
- Admin UI beyond Supabase Studio.
- News, AI previews, weather, notifications, rankings, comments.
- User-facing prediction accuracy/ranking features.

## Main Risks

- KBO HTML structure may change; crawler should be isolated and fault-tolerant.
- Player name matching can be messy. Store `raw_text` and allow unresolved records.
- Voting requires careful API-only writes so the service role key never leaks.
- Official announced starters, actual starters, and system predictions must remain separate record types.
- KST date handling must be consistent across frontend, API, crawler, and GitHub Actions.
- Baseball innings should not be treated as normal decimals for calculations; prefer `outs_pitched` for logic.
- Doubleheaders or rescheduled games can break a simple `date + teams` unique key.

## First Development Slice

1. Create Next.js app with TypeScript and Tailwind.
2. Add Supabase schema SQL and seed fixtures.
3. Implement server data access using mock/seed-backed patterns first.
4. Build home and game detail UI.
5. Implement prediction calculation from seeded `pitcher_appearances`.
6. Implement votes API and UI.
7. Run a KBO GameCenter parser spike against public HTML.
8. Add calendar/team views.
9. Add crawler and GitHub Actions.

## Product Positioning Decision

Use this framing:

```text
KBO 경기 전 선발 정보 정리 서비스
```

Avoid making prediction accuracy the emotional center of the product. Official, rotation-based, fan-voted, and actual starter information must be visually distinct.

Preferred UI terms:

- `로테이션 예상` instead of `시스템 예상` when space allows.
- `공식 예고` for official announced starters.
- `팬 예상` for vote results.
- `일치/다름` instead of `적중/불일치`.
- `참고 지표` or `예상 강도` instead of aggressive probability language if betting-like tone emerges.

Core trust copy:

```text
최근 선발 로테이션과 공개 데이터를 바탕으로 한 참고용 예상입니다. 승패 예측이나 베팅 목적의 정보가 아닙니다.
```

