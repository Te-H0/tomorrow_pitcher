# KBO Source Contract

This note fixes the source boundary for crawler and manual verification work. Its purpose is to prove that the service can extract the needed values from the selected KBO public pages, not from portal/news mirrors.

## Allowed Sources

Use only these pages for starter/schedule verification unless the user explicitly approves a new source.

| Data | Source URL | Status |
|---|---|---|
| Schedule and game result status | `https://www.koreabaseball.com/Schedule/Schedule.aspx` | Confirmed, parser live (`extract-kbo-schedule.mjs`) |
| Game-day list + official/actual starters + playerId | `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=YYYYMMDD` (date-page `li.game-cont` attributes) | Confirmed 2026-07-18 (`extract-kbo-preview.mjs`, `extract-kbo-review.mjs`) |
| Actual starters, box score, pitcher/hitter records | `...GameCenter/Main.aspx?gameDate=YYYYMMDD&gameId={gameId}&section=REVIEW` (finished `end` games only) | Confirmed 2026-07-18 (`extract-kbo-review.mjs`) |
| Team standings + head-to-head | `https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx` | Confirmed 2026-07-18 (`extract-kbo-standings.mjs`) |
| Registration/de-registration | `https://www.koreabaseball.com/Player/Register.aspx` | Confirmed 2026-07-18 (`extract-kbo-availability.mjs`) |
| Pitcher master/player ID | `https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx` and pitcher detail pages | Selected, parser not finalized |
| Movement detail context | `https://www.koreabaseball.com/Player/Trade.aspx` | Out of scope for this stage |

## Disallowed For Verification

- Do not use Nate, Naver, Daum, news wires, blogs, community posts, or search snippets as starter/schedule verification sources.
- Do not use portal/news pages to fill official announced starters or actual starters.
- If a non-KBO source is useful as a human clue, record it as an unresolved note only after user approval; do not treat it as source data.
- Do not call KBO `/ws/` internal API paths.

## Confirmed DOM Contract (2026-07-18 live probe)

Shared helper: `scripts/lib/kbo.mjs`. Common: fixed UA, 500ms delay, KST helpers, idempotent md upsert.

### GameCenter date page — `li.game-cont` attributes (핵심)

One load of `...GameCenter/Main.aspx?gameDate=YYYYMMDD` renders every game of the day as `li.game-cont`.
Most data is in **attributes** (no `/ws/` internal API):

```text
g_id          gameId (예: 20260719KTLG0) — gameId의 유일한 소스
g_dt          날짜 YYYYMMDD
s_nm          구장명
away_id/home_id   KBO 팀코드 (KT LG SS HT OB LT HH NC SK WO)
away_nm/home_nm   팀 표시명 (한글) — 팀명은 이 속성을 신뢰
away_p_id/home_p_id  선발투수 KBO playerId (예고/실제 공통)
start_ck      "1"이면 선발 발표됨
result_ck     "1"이면 경기 결과 존재
class         "game-cont" + 상태: end / cancel / (없음=예정)
선발 이름     .team.away|.home .today-pitcher p  ("선" 접두어 span 제거)
```

- 주의: 서비스 윈도우 밖 과거 날짜는 가까운 유효일로 **clamp**된다. 수집 스크립트는 `g_dt === 요청일` 필터로 방어.
- 취소 경기(class `cancel`)는 `away_p_id/home_p_id`가 있어도 ACTUAL을 만들지 않는다(예고만 존재).

### GameCenter REVIEW — 종료(`end`) 경기 상세

`...&gameId={g_id}&section=REVIEW`:

```text
tblScordboard1  팀명+시즌전적 (원정, 홈 2행)
tblScordboard2  이닝별 득점 1~12
tblScordboard3  합계 R H E B
tblEtc          결승타/홈런/2루타/실책/심판 등 (행별 항목명+내용)
tblAwayPitcher / tblHomePitcher  투수 전원 (선수명 등판 결과 승 패 세 이닝 타자 투구수 타수 피안타 홈런 4사구 삼진 실점 자책 평균자책점)
tblAwayHitter1/3, tblHomeHitter1/3  타자 (1=타순/포지션/선수명, 3=타수 안타 타점 득점 타율)
```

- 실제 선발 = 투수 테이블에서 `등판` 셀이 "선발"인 행. 팀명은 REVIEW의 `tblScordboard1`이 아니라 날짜 페이지 `li.game-cont` 속성을 신뢰.

### TeamRankDaily.aspx — 순위

```text
table.tData (1번째)  순위표: 순위 팀명 경기 승 패 무 승률 게임차 최근10경기 연속 홈 방문
table.tData (2번째)  팀간 승패표(상대전적 매트릭스)
```

### Register.aspx — 등록/말소

```text
팀 전환: 팀 탭 앵커 클릭 (href="javascript:fnSearchChange('CODE')", 코드 SS LG KT HT OB HH NC LT SK WO)
        — evaluate 직접 호출은 __doPostBack strict-mode 에러로 실패하므로 앵커 클릭 후 networkidle 대기.
table.tNData 마지막 2개  당일 1군 등록 / 말소 (등번호 선수명 포지션 투타유형 생년월일 체격)
비어있으면 "당일 1군 등록/말소된 선수가 없습니다." 행.
앞쪽 tNData는 현재 1군 로스터(감독/코치/투수/…) — 투수 테이블은 로스터 스냅샷 활용 가능.
```

## DOM Contracts Still Needed

- Pitcher master pages: exact selector for KBO `playerId`, pitcher name, team, handedness, and season stats (playerId 자체는 game-cont `away_p_id/home_p_id`로 이미 확보됨).
- `Schedule.aspx` gameId is derived as `YYYYMMDD + awayCode + homeCode + "0"`; may need extension for doubleheaders/suspended/rescheduled edge cases.

## Scheduler Notes

Future scheduler design should use KST windows and keep the same source boundary.

- Official announced starter sync: after KBO publishes previews, with repeated checks before first pitch.
- Actual starter sync: after games are confirmed finished on `Schedule.aspx` or KBO scoreboard, then read GameCenter `REVIEW`.
- A practical manual-test reminder time is around 23:10 KST for 18:30 games, but production scheduling should check game status rather than assume all games ended.
- Rainout, cancelled, postponed, suspended, or no-game rows must not create `ACTUAL` starter records.
