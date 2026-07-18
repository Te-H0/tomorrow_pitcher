# MD Data Pipeline (검증 운영 단계) 구현 스펙

## Status

2026-07-18 확정. 본개발(DB/서버) 전 검증 단계의 자동 수집 파이프라인 스펙.

## 목적

- DB/서버 없이 파이프라인 전체(수집 → 예측 → 결과 비교)를 GitHub Actions로 자동 운영한다.
- 모든 산출물은 이 레포의 `docs/data/` md 파일에 축적한다. 커밋 히스토리가 검증 로그다.
- 파서/정규화 로직은 본개발에서 그대로 재사용할 형태로 만들고, 마지막 "md 저장" 단계만 나중에 DB upsert로 교체한다.
- 운영 현황 파악과 AI 요청 대응은 `docs/data/README.md`(데이터 카탈로그) 하나로 해결한다.

## 2026-07-18 라이브 프로브로 확정한 DOM 계약

기존 `kbo-source-contract.md`의 "DOM Contracts Still Needed" 중 아래가 해소됨. 이 내용을 kbo-source-contract.md에도 반영할 것.

### GameCenter 날짜 페이지 (핵심 발견)

`https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=YYYYMMDD`

한 번 로드하면 해당 날짜 전체 경기가 `li.game-cont` 요소로 나오고, **속성만으로 대부분의 데이터가 해결된다**:

```text
li.game-cont 속성:
  g_id          gameId (예: 20260719KTLG0)  ← gameId의 유일한 소스로 사용
  g_dt          날짜 YYYYMMDD
  s_nm          구장명
  away_id/home_id   KBO 팀코드 (KT, LG, SS, HT, OB, LT, HH, NC, SK, WO)
  away_nm/home_nm   팀 표시명 (한글)
  away_p_id/home_p_id  선발투수 KBO playerId ← 예고/실제 선발의 playerId!
  start_ck      "1"이면 선발 발표됨
  result_ck     "1"이면 경기 결과 존재
  class         "game-cont" + 상태: "end"(종료) / "cancel"(취소) / 없음(예정)

선발 이름: li.game-cont 내부 .team.away .today-pitcher p ("선" 접두어 span 제거 후 텍스트)
           .team.home .today-pitcher p 동일
```

- 실측: 07.17 롯데@삼성은 `cancel` + `result_ck=0`인데 `away_p_id/home_p_id` 존재 → "취소 경기는 예고 선발만 있고 ACTUAL 없음" 정책의 실제 사례.
- 주의: 이 속성은 공개 페이지의 렌더링된 DOM이며 `/ws/` 내부 API 호출이 아님 (소스 계약 준수).
- 기존 문서의 "GameCenter는 playerId를 노출하지 않는다"는 서술은 갱신 필요 (DOM 속성으로 노출됨).

### GameCenter REVIEW (종료 경기 상세)

`...Main.aspx?gameDate=YYYYMMDD&gameId={g_id}&section=REVIEW` (반드시 `end` 경기만)

| 테이블 id | 내용 | 컬럼 |
|---|---|---|
| `tblScordboard1` | 팀명+시즌전적 | (2행: 원정, 홈) |
| `tblScordboard2` | 이닝별 득점 | 1~12회 |
| `tblScordboard3` | 합계 | R H E B |
| `tblEtc` | 결승타/홈런/2루타/실책/심판 등 | 행별 항목명+내용 |
| `tblAwayPitcher` / `tblHomePitcher` | 투수 전원 기록 | 선수명 등판 결과 승 패 세 이닝 타자 투구수 타수 피안타 홈런 4사구 삼진 실점 자책 평균자책점 |
| `tblAwayHitter1/3`, `tblHomeHitter1/3` | 타자 기록 (1=타순/포지션/선수명, 3=타수 안타 타점 득점 타율) | 이름 없는 중간 테이블 = 이닝별 결과 |

- 실제 선발 = 투수 테이블에서 `등판` 셀이 "선발"인 행 (기존 방식 유지하되 전체 행을 수집).
- `tblScordboard1`의 팀명 텍스트가 아닌, 날짜 페이지 `li.game-cont` 속성의 팀 정보를 신뢰할 것.

### 팀 순위

`https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx` (서버 렌더링, JS 불필요하지만 일관성 위해 Playwright 사용 가능)

```text
table.tData (1번째): 순위표
  컬럼: 순위 팀명 경기 승 패 무 승률 게임차 최근10경기 연속 홈 방문
table.tData (2번째): 팀간 승패표 (상대전적 매트릭스)
```

### 등록/말소 (Register.aspx)

`https://www.koreabaseball.com/Player/Register.aspx`

- 팀 전환: `page.evaluate`로 `fnSearchChange('SS')` 등 호출 (팀코드: SS LG KT HT OB HH NC LT SK WO) 후 대기.
- 페이지 하단 `table.tNData` 중 **마지막 2개**가 "당일 1군 등록" / "당일 1군 말소" (컬럼: 등번호 선수명 포지션 투타유형 생년월일 체격).
- 비어있으면 "당일 1군 등록된 선수가 없습니다." 텍스트 행.
- 앞쪽 tNData 테이블들은 현재 1군 로스터 전체(감독/코치/투수/포수/내야수/외야수) — 투수 테이블은 로스터 스냅샷으로 활용 가능.

### Schedule.aspx (기존 구현 유지 + 알려진 한계)

- 기존 `extract-kbo-schedule.mjs` 셀렉터 유지.
- 한계(수정 대상 아님, 기록만): 경기 진행 중인 당일 경기는 상태가 "미정", gameId 빈값으로 나옴. GameCenter 날짜 페이지 속성으로 보완됨.

## 파일 구조 (docs/data/ 재편)

```text
docs/data/
  README.md                      # AI용 데이터 카탈로그 (아래 별도 섹션)
  schedule/2026-07.md            # 월별 일정+상태 (기존 파일 이동: 2026-04, 05, 06, 07)
  starters/actual/2026-07.md     # 실제 선발 (기존 kbo-starters 파일 이동)
  starters/official/2026-07.md   # 공식 예고 선발 (신규)
  starters/predicted/2026-07.md  # 시스템 예상 선발 (신규, 생성물)
  rotation/slots.md              # 팀별 로테이션 슬롯 (수동 관리)
  rotation/pointers.md           # 팀별 다음 선발 포인터 (수동+자동)
  standings/2026-07.md           # 일자별 순위 스냅샷 (신규)
  availability/2026-07.md        # 일자별 등록/말소 (신규)
  games/2026-07.md               # 경기 결과 상세: 스코어보드+투수 전원+타자 기록 (신규)
  archive/                       # 재편 전 구파일 중 이동 불가한 것 (forecast 실험 문서 등)
```

- 기존 `2026-MM-kbo-schedule.md` → `schedule/2026-MM.md`, `2026-MM-kbo-starters.md` → `starters/actual/2026-MM.md`로 git mv. 헤더 형식은 새 스크립트 출력과 통일.
- 기존 `2026-04-05-rotation-analysis.md`, `2026-05/06-09-starter-forecast.md`는 `archive/`로 이동 (실험 기록 보존).
- 모든 시각 표기는 KST. 각 파일 상단에 "마지막 갱신: YYYY-MM-DD HH:mm KST + 생성 스크립트명" 명시.

## 스크립트 (scripts/)

공통 원칙:

- Node ESM(.mjs), Playwright chromium, 기존 UA 문자열 유지, 요청 간 500ms 대기.
- 파싱 결과 0건이면 exit code 1로 실패 처리 (Actions 실패 알림 트리거). 단 "그 날짜에 경기 없음"이 명확하면 정상 종료.
- 모든 쓰기는 **멱등**: 같은 입력으로 두 번 돌려도 결과 파일이 같아야 함. 월별 파일에서 해당 날짜/게임 행만 교체(upsert).
- 날짜 인자 생략 시 KST 기준 기본값 사용 (`Asia/Seoul`로 명시 계산, 러너는 UTC임).
- 공통 로직은 `scripts/lib/kbo.mjs`로 추출: 브라우저 실행, KST 헬퍼, md 테이블 파서/직렬화, 팀코드 맵, 파일 upsert 헬퍼.

| 스크립트 | 인자 | 소스 | 출력 | 스케줄 |
|---|---|---|---|---|
| `extract-kbo-schedule.mjs` | YYYY MM (기존 유지) | Schedule.aspx | `schedule/YYYY-MM.md` | daily 08:00 |
| `extract-kbo-preview.mjs` | [YYYYMMDD, 기본 오늘+내일] | GameCenter 날짜 페이지 속성 | `starters/official/YYYY-MM.md` | preview 잡 |
| `extract-kbo-review.mjs` | [YYYYMMDD, 기본 오늘] | GameCenter 날짜 페이지 → `end` 경기만 REVIEW | `starters/actual/YYYY-MM.md` + `games/YYYY-MM.md` | postgame 잡 |
| `extract-kbo-standings.mjs` | 없음 | TeamRankDaily.aspx | `standings/YYYY-MM.md` (당일 섹션 교체) | postgame + daily |
| `extract-kbo-availability.mjs` | 없음(당일) | Register.aspx 팀 10곳 순회 | `availability/YYYY-MM.md` (당일 섹션 교체) | preview 잡 15시 회차 |
| `generate-starter-forecast.mjs` | [D+N 기본 1~3] | rotation/*.md + schedule + official + actual | `starters/predicted/YYYY-MM.md` + `rotation/pointers.md` 갱신 | postgame 잡 마지막 |

### 출력 형식 상세

`starters/official/YYYY-MM.md`: gameId당 1행 upsert.

```text
| 날짜 | gameId | 원정 | 원정 예고선발 | 원정 playerId | 홈 | 홈 예고선발 | 홈 playerId | 최초수집(KST) | 최종확인(KST) |
```

- 이미 있는 행과 선발 이름이 다르면(예고 교체) 행을 갱신하고 파일 하단 `## 변경 이력`에 `| 시각 | gameId | 팀 | 이전 → 이후 |` 추가.

`starters/actual/YYYY-MM.md`: gameId당 1행.

```text
| 날짜 | gameId | 원정 | 원정 선발 | 홈 | 홈 선발 | 구장 | 상태 |
```

- 상태는 `end`만 기록. `cancel` 경기는 `## 취소/노게임` 섹션에 별도 기록 (ACTUAL 생성 금지 정책 그대로).

`games/YYYY-MM.md`: 경기당 1섹션 upsert.

```text
## MM.DD {원정} @ {홈} ({gameId})
결과: {원정 R}:{홈 R} / H-E-B, 이닝별 스코어 한 줄
결승타/홈런 등 tblEtc 요약
### 투수 기록
원정/홈 투수 테이블 전체 행 (컬럼 그대로)
### 타자 기록
원정/홈 타자 요약 (타순, 선수명, 타수 안타 타점 득점 타율)
```

`standings/YYYY-MM.md`: 날짜당 1섹션 교체.

```text
## YYYY-MM-DD
순위표 (원본 컬럼 그대로)
### 팀간 승패표
매트릭스 그대로
```

`availability/YYYY-MM.md`: 날짜당 1섹션 교체. 팀별 등록/말소 행 나열. 전 팀 변동 없으면 "변동 없음" 한 줄.

### rotation 파일 (이 단계의 "관리자 페이지")

`rotation/slots.md`: 팀별 선발 순서. 사람/AI가 뉴스 보고 수동 편집.

```text
## LG
| 슬롯 | 투수 | 상태 | 메모 |
| 1 | 임찬규 | ACTIVE | |
...
```

`rotation/pointers.md`: 팀별 다음 슬롯 포인터.

```text
| 팀 | 다음 슬롯 | 마지막 반영 경기 | 갱신 시각(KST) | 갱신 주체 | 메모 |
```

- 시드: 최근 실제 선발 데이터(7월 `starters/actual`)에서 팀별 최근 선발 등판 순서를 뽑아 슬롯 5~6개를 구성하고 포인터를 계산해 초기값 작성. 시드 후 사람이 검토한다는 주석 필수.

### generate-starter-forecast.mjs 로직 (포인터 자동 전진 규칙)

```text
1. 어제(KST) actual 선발을 읽는다.
2. 팀별로: 어제 실제 선발 == 포인터가 가리키는 슬롯 투수면
   → 포인터를 다음 슬롯으로 전진, "갱신 주체=auto" 기록
   불일치 / 취소 경기 / 어제 경기 없음(월요일 등)이면
   → 포인터 유지, pointers.md 메모에 "확인 필요: {사유}" 기록
3. 오늘~D+3 일정에서 각 경기/팀의 예상 선발 = 포인터 슬롯 투수.
4. starters/predicted/YYYY-MM.md에 gameId당 1행 upsert:
   | 날짜 | gameId | 팀 | 예상 선발 | 근거 슬롯 | 생성 시각(KST) |
   이미 공식 예고가 있으면 "비교" 컬럼에 일치/불일치 표시.
5. 예측을 사후 수정하지 않는다. 공식 예고/실제와 다르면 비교 컬럼으로만 남긴다 (적중률 검증용).
```

## GitHub Actions (.github/workflows/)

공통:

- `permissions: contents: write`, `concurrency: group: data-sync, cancel-in-progress: false` (푸시 경합 방지, 워크플로우 3개가 같은 그룹 공유).
- Node 22, `npm ci`, `npx playwright install chromium --with-deps`.
- 실행 후 `git add docs/data && git diff --cached --quiet || (git commit -m "data: ..." && git pull --rebase && git push)`.
- 커밋 author: `github-actions[bot]`.
- cron은 UTC로 환산 (KST-9). 지연 수 분~수십 분 가능함을 전제로 설계.
- 각 워크플로우에 `workflow_dispatch` 추가 (수동 실행 가능).

| 파일 | cron (KST 의도 → UTC) | 스텝 |
|---|---|---|
| `sync-daily.yml` | 08:00 → `0 23 * * *` | schedule(당월) → standings → availability 보정 1회 |
| `sync-preview.yml` | 09,12,18,21,23시 → `0 0,3,9,12,14 * * *` | preview(오늘+내일). 15시 회차(`0 6`)에는 availability도 |
| `sync-postgame.yml` | 21:30~24:30 30분 간격 → `0,30 12-15 * * *` | review(오늘) → standings → forecast(오늘~D+3) |

- 첫 배포 시 **Actions 러너(해외 IP)에서 koreabaseball.com 접근 가능한지부터 확인**. sync-daily 하나만 먼저 머지해 수동 실행으로 검증할 것. 차단 시 셀프호스티드 러너 등 대안 검토.

## docs/data/README.md — AI용 데이터 카탈로그 (최중요 산출물)

**"이 문서 하나 보면 AI가 모든 데이터 요청에 대응할 수 있다"**가 요구사항. 반드시 포함:

1. 한 줄 소개 + "이 레포는 검증 운영 단계로, md가 DB 역할" 설명.
2. 카탈로그 표: 데이터 종류 | 파일 경로 패턴 | 원본 소스 | 갱신 잡/시각(KST) | 비고.
3. **요청 → 대응 플레이북** (핵심):
   - "이번 달 경기 일정/결과 줘" → `schedule/YYYY-MM.md` 읽고 답변
   - "실제 선발 기록 줘" → `starters/actual/`
   - "내일 선발 예측 줘" → `starters/predicted/` 확인, 최신 아니면 `node scripts/generate-starter-forecast.mjs` 실행 후 답변
   - "예고 선발 떴어?" → `starters/official/` 확인, 오래됐으면 `node scripts/extract-kbo-preview.mjs` 실행
   - "예측 잘 맞았어?" → predicted의 비교 컬럼 + actual 대조 방법 설명
   - "순위/등록말소" → 각 파일
   - "로테이션 바꿔줘/포인터 수정해줘" → `rotation/slots.md`, `rotation/pointers.md` 편집 절차 + 메모 규칙
   - 각 항목에 "파일이 오래됐을 때 돌릴 명령어" 명시
4. 수동 실행 명령어 전체 목록 (`node scripts/... 인자`).
5. 데이터 신뢰 순위: ACTUAL > OFFICIAL_ANNOUNCED > SYSTEM_PREDICTED (기존 정책 동일).
6. 장애 대응: Actions 실패 시 확인 순서, 파서 0건 시 의심 지점(DOM 변경).
7. 본개발 전환 시 바뀌는 것: "md 저장부만 DB upsert로 교체" 한 단락.

## 기타 문서 갱신

- `AGENTS.md` 또는 `CLAUDE.md`의 core references에 `docs/data/README.md` 추가.
- `docs/dev-plans/kbo-source-contract.md`: 확정된 DOM 계약 반영 (game-cont 속성, tData, tNData, REVIEW 테이블 id), "Still Needed"에서 해소 항목 제거, TeamRankDaily/게임센터 날짜 페이지를 Allowed Sources에 추가.
- `docs/backlog.md`: 해당 완료 항목 체크, 신규 항목(Actions 해외 IP 검증, 라이브 경기 상태 파서 한계) 추가.
- `docs/progress/`에 작업 요약 1건.
- `package.json` scripts를 새 스크립트 체계로 정리 (`data:preview`, `data:review`, `data:standings`, `data:availability`, `data:forecast` 등 날짜 인자 없이 기본 실행 가능하게).

## 명시적 비목표

- DB/Supabase/서버/미니앱 코드 작성 금지 (이번 단계 아님).
- 뉴스 크롤링, AI 자동 예측 변경 금지 (기존 결정 유지).
- Trade.aspx 파서는 이번 단계 제외 (Register.aspx만).
- 예측 로직 고도화 금지 — 포인터 방식 그대로.
