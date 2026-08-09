# KBO 데이터 워크스페이스 (AI 카탈로그)

`tomorrow_pitcher`(KBO 경기 전 선발 정보 정리 서비스)의 **검증 운영 단계** 데이터 폴더다.
DB/서버 없이 GitHub Actions가 KBO 공개 페이지를 수집해 이 폴더의 **md 파일에 축적**한다.
즉, 지금 단계에서는 **md 파일이 DB 역할**을 하고 커밋 히스토리가 검증 로그다.

> 이 문서 하나로 모든 데이터 요청에 대응한다. "무슨 파일을 읽고, 오래됐으면 무슨 명령을 돌릴지"가 여기 다 있다.
> 모든 시각은 KST(`Asia/Seoul`). 각 파일 상단에 "마지막 갱신: … KST + 생성 스크립트"가 적혀 있다.

## 1. 데이터 카탈로그

| 데이터 종류 | 파일 경로 패턴 | 원본 소스 | 갱신 잡 / 시각(KST) | 비고 |
|---|---|---|---|---|
| 월별 일정+상태 | `schedule/YYYY-MM.md` | `Schedule.aspx` | sync-daily 08:00 | 진행 중 당일 경기는 상태 "미정"·gameId 빈값(한계). |
| 공식 예고 선발 | `starters/official/YYYY-MM.md` | GameCenter 날짜 페이지 `li.game-cont`(start_ck=1) | sync-preview 09/12/15/18/21/23 | gameId당 1행. 하단 `## 변경 이력`에 예고 교체 기록. |
| 실제 선발 | `starters/actual/YYYY-MM.md` | GameCenter REVIEW(등판=선발) | sync-postgame 21:30~24:30 + sync-daily 08:00(익일 백필) | ACTUAL(최상위 신뢰). 취소 경기는 `## 취소/노게임`에만 기록. 미기록 end 경기만 REVIEW 접속. |
| 시스템 예상 선발 | `starters/predicted/YYYY-MM.md` | rotation/* + schedule + official + actual(취소) | sync-postgame(신규 있을 때) + sync-daily 아침 1회 | 생성물. 예측은 사후 수정 없음, 비교 컬럼(일치/불일치/예고대기/취소)으로만 검증. |
| 경기 결과 상세 | `games/YYYY-MM.md` | GameCenter REVIEW | sync-postgame + sync-daily 08:00(익일 백필) | 스코어보드 + 투수 전원 + 타자 기록. 경기당 1섹션. |
| 일자별 순위 | `standings/YYYY-MM.md` | `TeamRankDaily.aspx` | sync-daily + sync-postgame | 순위표 + 팀간 승패표. 날짜당 1섹션. |
| 일자별 등록/말소 | `availability/YYYY-MM.md` | `Register.aspx`(팀 10곳) | sync-daily 08:00 + sync-preview 15:00 | 전 팀 변동 없으면 "변동 없음". |
| 로테이션 슬롯 | `rotation/slots.md` | 수동(사람/AI) | 수시 | 팀별 선발 순서. 뉴스 보고 편집. |
| 로테이션 포인터 | `rotation/pointers.md` | 수동 + forecast 자동 | sync-postgame | 팀별 다음 선발 슬롯. auto/auto-hold/seed 주체 표기. |
| 과거 실험 문서 | `archive/*.md` | (보존) | — | 재편 전 forecast/rotation 실험 기록. |

## 2. 요청 → 대응 플레이북

각 항목: **읽을 파일** → (오래됐으면) **돌릴 명령어**.

- **"이번 달 경기 일정/결과 줘"** → `schedule/YYYY-MM.md` 읽고 답변.
  오래됐으면 `node scripts/extract-kbo-schedule.mjs` (당월) 또는 `... YYYY MM`.
- **"실제 선발 기록 줘"** → `starters/actual/YYYY-MM.md`.
  최신 아니면 `node scripts/extract-kbo-review.mjs [YYYYMMDD|yesterday]` (기본 오늘).
  이미 기록된 gameId(actual 본문·취소 섹션·`games/` 섹션)는 재접속하지 않고, **미기록 end 경기만** REVIEW 수집한다. 신규 0 + 잔여(pending) 0이면 파일을 건드리지 않고 즉시 종료(멱등). 자정 넘겨 종료된 미기록 경기는 다음 날 아침 `yesterday` 백필로 보정된다.
- **"내일 선발 예측 줘"** → `starters/predicted/YYYY-MM.md` 확인.
  최신 아니면 `node scripts/generate-starter-forecast.mjs` 후 답변.
- **"예고 선발 떴어?"** → `starters/official/YYYY-MM.md` 확인.
  오래됐으면 `node scripts/extract-kbo-preview.mjs` (오늘+내일).
- **"예측 잘 맞았어?"** → `predicted`의 **비교** 컬럼(일치/불일치/예고대기/취소)을 본다.
  `취소`는 경기 취소 확정 행으로 적중률 집계에서 제외한다. 실제 대조는 같은 gameId를 `starters/actual`에서 찾아 예상 선발 vs 실제 선발 비교(관측상 예고=실제 100%라 예고 대조로 충분). 예측은 사후 수정하지 않으므로 생성 시각이 곧 예측 시점이다.
- **"순위 알려줘"** → `standings/YYYY-MM.md` 최신 날짜 섹션.
  오래됐으면 `node scripts/extract-kbo-standings.mjs`.
- **"오늘 등록/말소 있어?"** → `availability/YYYY-MM.md` 해당 날짜 섹션.
  오래됐으면 `node scripts/extract-kbo-availability.mjs`.
- **"경기 결과 상세(스코어/투수/타자) 줘"** → `games/YYYY-MM.md`의 해당 경기 섹션.
  없으면 `node scripts/extract-kbo-review.mjs YYYYMMDD`.
- **"로테이션 바꿔줘 / 포인터 수정해줘"** →
  - 순서/부상 반영: `rotation/slots.md`의 팀 섹션에서 슬롯 행(투수/상태/메모) 편집.
  - 다음 차례 수정: `rotation/pointers.md`에서 해당 팀 `다음 슬롯` 변경, `갱신 주체`를 `manual`, `메모`에 사유 기입.
  - 편집 후 `node scripts/generate-starter-forecast.mjs`로 예측 재생성.

## 3. 수동 실행 명령어 전체

```bash
node scripts/extract-kbo-schedule.mjs [YYYY] [MM]     # 기본: 당월(KST)
node scripts/extract-kbo-preview.mjs [YYYYMMDD]       # 기본: 오늘+내일
node scripts/extract-kbo-review.mjs [YYYYMMDD|yesterday]  # 기본: 오늘. yesterday=KST 어제(익일 백필)
node scripts/extract-kbo-standings.mjs                # 당일 순위
node scripts/extract-kbo-availability.mjs             # 당일 등록/말소(10팀)
node scripts/generate-starter-forecast.mjs [D+N]      # 기본: 오늘~D+3
```

npm 스크립트 별칭: `npm run data:schedule | data:preview | data:review | data:standings | data:availability | data:forecast`.

## 4. 데이터 신뢰 순위

`ACTUAL > OFFICIAL_ANNOUNCED > SYSTEM_PREDICTED`.

- **ACTUAL**(`starters/actual`): 경기 종료 후 REVIEW 확정. 최우선.
- **OFFICIAL_ANNOUNCED**(`starters/official`): KBO 공식 예고. 아직 실제와 다를 수 있음.
- **SYSTEM_PREDICTED**(`starters/predicted`): 로테이션 포인터 추정. 참고용, 사후 수정 안 함.
- 실제가 예고/예측과 **다를 수 있다**고 전제할 것. 서로 덮어쓰지 않고 별도 파일로 분리 보관한다.

## 5. 장애 대응

- **Actions 실패 알림**: 각 스크립트는 파싱 0건이면 exit 1(단, "해당 날짜 경기 없음"이 확인되면 정상 종료).
  1. 실패한 워크플로우 로그에서 어느 스크립트가 죽었는지 확인.
  2. 로컬에서 같은 명령을 수동 실행해 재현.
- **파서 0건 / 값이 이상함 → KBO DOM 변경 의심**. 확인 지점:
  - `li.game-cont` 속성명(g_id, g_dt, away_id/home_id, away_p_id/home_p_id, start_ck, result_ck, class end/cancel).
  - REVIEW 테이블 id(`tblScordboard1~3`, `tblEtc`, `tblAwayPitcher`/`tblHomePitcher`, `tblAwayHitter1/3` 등).
  - 순위: `table.tData`(1=순위표, 2=승패표). 등록/말소: `table.tNData` 마지막 2개, 팀 전환은 팀 탭 앵커 클릭(`fnSearchChange`).
  - 확정 DOM 계약은 `docs/dev-plans/kbo-source-contract.md` 참조.
- **날짜가 밀림**: GameCenter 날짜 페이지는 서비스 윈도우 밖 과거 날짜를 가까운 유효일로 clamp한다. preview/review는 `g_dt === 요청일` 필터로 방어하므로, 오래된 날짜를 넣으면 "경기 없음"으로 정상 종료된다(과거 백필은 gameId 직접 REVIEW 필요).
- 커밋 경합: 워크플로우 3개가 `concurrency: data-sync` 그룹을 공유하고 `git pull --rebase` 후 push 한다.

## 6. 규칙

- 검증 데이터는 KBO 공개 페이지만 사용한다(포털/뉴스 미러 금지, `/ws/` 내부 API 금지). 자세한 경계는 `kbo-source-contract.md`.
- 베팅성 표현 금지(픽/승부/확률/배당 등). `로테이션 예상 / 공식 예고 / 실제 선발 / 일치 / 다름` 용어 사용.
- 취소/노게임/우천은 ACTUAL을 만들지 않는다.

## 7. 본개발 전환 시 바뀌는 것

파서/정규화 로직은 그대로 재사용한다. **마지막 "md 저장" 단계만 Supabase upsert로 교체**하면 된다.
각 스크립트의 `writeFileEnsured(...)`(md 직렬화) 부분이 도메인 테이블 upsert로 대체되고, 나머지(수집·정규화·신뢰순위·KST 처리)는 유지된다. 이 md들은 초기 seed/fixture 후보가 된다.
