# Backlog

This file tracks open questions, pending decisions, and next tasks that should not be lost between AI coding sessions.

## Rules

- Add items here when a question or task remains after discussion.
- Keep items short and actionable.
- Move accepted long-term decisions into `docs/decisions/`.
- Move detailed implementation plans into `docs/dev-plans/`.
- Move completed work summaries into `docs/progress/`.
- Do not use this as a daily log.

## Pending Decisions

- [x] Decide MVP first screen scope: home as today's game report, with game detail as the core product surface.
- [x] Decide launch platform: pivot MVP frontend to Apps in Toss WebView mini app.
- [x] Decide MVP player photo policy: exclude real player photos until rights are secured.
- [ ] Decide initial admin workflow: Supabase Studio/import scripts first, or a minimal admin page.
- [ ] Decide first import range: 2026 full published schedule, or 2026 April-May first.
- [x] Decide prediction v1 scope: simple admin-managed rotation pointer only; defer rank-2 variable candidates.
- [x] Decide manual availability review semantics: KBO movement/news are admin context only in MVP v1, not automatic prediction mutation.
- [x] Decide rotation admin semantics: admins manage rotation order and current pointer after rainouts, skips, temporary starters, and manual corrections.
- [ ] Decide whether `starting_pitcher_records.confidence` is excluded from MVP schema or kept as an internal-only nullable field.
- [ ] Decide whether Toss Login is MVP day-one or post-business-registration follow-up.
- [ ] Decide immutable Apps in Toss `appName`, logo, and primary brand color for `야구일보`.
- [ ] Decide whether any Next.js app remains for admin/API or the MVP uses a separate lightweight server/API.

## Next Tasks

- [ ] Install Apps in Toss Codex skill from `toss/apps-in-toss-skills` path `apps-in-toss`.
- [ ] Optionally configure Apps in Toss MCP with `ax mcp start` on each development machine.
- [ ] Register or access Apps in Toss console workspace.
- [ ] Register business information in Apps in Toss console and track review status.
- [ ] Validate `야구일보` as the Apps in Toss Korean display name before console registration.
- [ ] Install Apps in Toss sandbox app and verify local dev server access from device.
- [ ] Scaffold `apps/mini-app` with Apps in Toss WebView tooling.
- [ ] Rework MVP UI design system around TDS Mobile and Apps in Toss floating tabbar constraints.
- [ ] Implement MVP bottom tabs: `홈`, `일정`, `커뮤니티`, `순위`.
- [ ] Build home as today's game report for the selected team.
- [ ] Build schedule as a monthly calendar that opens game detail.
- [ ] Build community MVP as admin-curated polls without comments.
- [ ] Build standings MVP with team rankings first.
- [ ] Write final Supabase SQL migration for confirmed pitcher-first schema.
- [ ] Add teams seed data with canonical service codes and KBO codes.
- [ ] Build KBO pitcher master/playerId import from pitcher record/detail pages.
- [x] Build KBO schedule import from `Schedule.aspx`. (`extract-kbo-schedule.mjs`)
- [x] Build KBO player availability import from `Player/Register.aspx` (당일 등록/말소, `extract-kbo-availability.mjs`). Trade.aspx enrich는 이번 단계 제외.
- [x] Build GameCenter starter and pitcher appearance import. (preview=예고, review=실제+박스스코어)
- [x] Finalize DOM selector contract for `Schedule.aspx` status rows and GameCenter official starters. (2026-07-18 라이브 프로브로 확정, `kbo-source-contract.md` 반영)
- [ ] **Actions 러너(해외 IP)에서 koreabaseball.com 접근 가능 여부 검증**: sync-daily 하나만 먼저 머지해 수동 실행. 차단 시 셀프호스티드 러너 검토.
- [ ] 라이브 경기 상태 파서 한계 대응 검토: Schedule.aspx는 진행 중 당일 경기를 "미정"·gameId 빈값으로, GameCenter 날짜 페이지는 과거일을 가까운 유효일로 clamp함(현재는 `g_dt===요청일` 필터로 방어).
- [ ] `rotation/slots.md`·`pointers.md` 시드 사람 검토: 올스타 브레이크 직후 actual(07.08·09·16·17) 기반 잠정값이라 슬롯 순서 확정 필요.
- [ ] Update `docs/data/2026-06-09-starter-forecast.md` when KBO GameCenter `PREVIEW` publishes 06.09 official announced starters.
- [ ] After 06.09 games finish, verify `Schedule.aspx` statuses first, then extract GameCenter `REVIEW` actual starters and compare against 06.09 system/official records.
- [ ] Use 23:10 KST only as a manual-test reminder for post-game actual starter verification; production scheduler should trigger from KBO game status checks.
- [ ] Generate sample local seed data from April-May 2026 KBO records.
- [ ] Continue 05.26~05.31 rotation-pointer prediction test: 05.27 actual starters and 05.28 official comparison are documented; next confirm 05.28 actual starters after games finish, then update 05.29~05.31 corrected predictions.
- [ ] Add `team_rotation_states` to final schema and seed one next-slot pointer per KBO team.
- [ ] Implement first rotation prediction service from `team_rotation_states.next_slot_no`.
- [ ] Build minimal admin workflow for team rotation order, current pointer, and manual prediction correction before advanced news/AI signals.
- [ ] Build minimal home and game detail views.

## Later

- [ ] **뉴스 claims 파이프라인 (AI 추출)**: 취소/재편 트리거 + 매일 저녁 1회 네이버 뉴스 검색 API로 팀별 선발 관련 기사 수집 → LLM(Claude, Haiku급)으로 `(날짜, 팀, 투수, 확실성[명시/추정], 근거 문장, 출처, 발행시각)` claim 구조화 추출(명시된 것만·상대 날짜는 발행시각 기준 KST 절대화·claim 단위 디덥) → `starters/news-claims/YYYY-MM.md`(신뢰순위 NEWS_REPORTED, OFFICIAL과 SYSTEM 사이) 자동 기록. 예측과 불일치하는 `명시` claim만 확인 큐(GitHub 이슈)로 올리고, 운영자 승인 시 `rotation/overrides.md` 반영. 자동 예측 반영은 금지(MVP 정책 유지) — claims의 실측 적중률이 쌓인 뒤(예: 명시 등급 90%+) 자동 반영 격상을 별도 결정. 배경: 감독이 취소 직후 브리핑에서 D+1~3 로테이션 계획을 통째로 공개하는 관행 확인(예: 8/4 스포츠경향 KIA 기사) — 모델이 구조적으로 못 푸는 재개 첫날·임시 선발 구간의 유일한 정답 소스.

- [ ] Revisit player photos only after official permission or a paid license is available; model provider, source, scope, attribution, expiration, and removal status.
- [ ] Revisit hitter tables only when hitter/lineup features become real product scope.
- [ ] Revisit a generic `players` table only when cross-player features justify it.
- [ ] Revisit scheduled production import only after operational/legal/source policy is comfortable.
