# KBO Player Availability Source Notes

## Status

Draft source note from 2026-05-26 exploration. This is not a final implementation decision, but it is likely useful for the admin availability workflow.

## Candidate Sources

### Player Register

Source: `https://www.koreabaseball.com/Player/Register.aspx`

Use as the primary source for team/day registration and de-registration.

Observed behavior:

- Page exposes team tabs and a date context.
- Each team page separates `등록` and `말소`.
- On 2026.05.25, team-level de-registration rows were extractable from the rendered DOM.
- Some players appeared here even when a player-name search on the movement page did not return a matching detail row.

Test extraction on 2026.05.26:

| Date shown | Team | Registered | De-registered |
|---|---|---|---|
| 2026.05.25 | 삼성 | none | 양현 |
| 2026.05.25 | LG | none | 이상영 |
| 2026.05.25 | KT | none | 배제성 |
| 2026.05.25 | KIA | none | none |
| 2026.05.25 | 한화 | none | none |
| 2026.05.25 | SSG | none | 장지훈, 정동윤 |
| 2026.05.25 | 두산 | none | 박성재 |
| 2026.05.25 | 롯데 | none | 구승민, 로드리게스 |
| 2026.05.25 | 키움 | none | 오석주 |
| 2026.05.25 | NC | none | none |

### Player Movement

Source: `https://www.koreabaseball.com/Player/Trade.aspx`

Use as a secondary detail source. Search by player name to enrich registration/de-registration with event context such as injury list, rehabilitation list, waiver, military hold, added registration note, and free-agent status.

Observed behavior:

- The page exposes year, month, movement type, team, and player-name search controls.
- Search results include columns: date, item, team, player, note.
- The movement page is not a complete replacement for registration status because some currently de-registered players may not appear in player-name search results.

Test searches on 2026.05.26:

| Player | Result |
|---|---|
| 박성재 | 2026-05-16 소속선수 추가 등록, note `육성선수 말소`; 2026-01-31 자유계약선수 |
| 이상영 | 2026-05-01 소속선수 추가 등록; 2026-05-01 등번호 변경 |
| 최원태 | 2026-05-18 부상자 명단, note `10일` |
| 신민혁 | 2026-05-16 부상자 명단, note `30일` |
| 로드리게스 | no result in tested search |
| 배제성 | no result in tested search |
| 오석주 | no result in tested search |

## Proposed Admin Workflow

1. Use `Register.aspx` to identify whether a pitcher is currently registered or de-registered for a team/date.
2. For pitchers who are relevant to a rotation slot or candidate list, search `Trade.aspx` by player name.
3. Attach movement-detail context when found.
4. Show both facts as admin context near the rotation candidate.
5. Do not automatically mutate `rotation_slots`, `team_rotation_states`, or `starting_pitcher_records` from either source in MVP v1.

Example admin labels:

```text
말소 확인
부상자 명단 10일
부상자 명단 30일
치료·재활명단
상세 이력 없음
```

## Crawler Notes

- Use Playwright-rendered public pages.
- Do not call KBO `/ws/` internal API paths.
- Prefer `Register.aspx` as the first pass and `Trade.aspx` as enrichment.
- Keep raw player name, team, source date, source URL, event type, and note for review.
- If a name-only match is ambiguous, store the raw value for admin review instead of silently mapping to a pitcher.
