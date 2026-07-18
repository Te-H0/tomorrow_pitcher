# 2026-07-18 sync-postgame 조기 종료 + 익일 백필

`extract-kbo-review.mjs`가 30분 간격 postgame 7회 실행 중 이미 오늘 경기를 전부 처리했으면 이후 회차를 즉시 no-op으로 끝내도록 개선. 경기별 무조건 재수집을 제거하고, 자정 넘겨 종료된 미기록 경기의 익일 아침 백필을 추가.

## 구현

- `scripts/extract-kbo-review.mjs`:
  - GameCenter 날짜 페이지 1회 로드로 경기 상태를 `end`/`cancel`/pending(예정·진행중·서스펜디드)으로 분류.
  - 기존 산출물에서 기록된 gameId 파악: `starters/actual/YYYY-MM.md` 본문 행(원정 선발 테이블) + 취소 섹션(사유 테이블) + `games/YYYY-MM.md` 섹션 헤딩.
  - **미기록 end 경기만** REVIEW 접속·수집, 미기록 cancel만 취소 섹션 추가. 이미 기록된 경기는 재접속하지 않음.
  - 실행 요약 stdout 출력: `신규 수집 n · 신규 취소 n · 잔여(pending) n · 스킵 n`.
  - `GITHUB_OUTPUT` 있으면 `collected=<신규 수집+신규 취소>` / `pending=<n>` append(Actions 스텝 출력).
  - 신규 0 + pending 0이면 "오늘 경기 전부 처리 완료 — 신규 없음" 로그 후 exit 0. **신규 0이면 파일 미수정**(멱등: 갱신 시각 라인만 바뀌는 diff 방지).
  - 인자 `yesterday` 지원(KST 기준 어제, lib `kstYmdOffset(-1)`). 기존 멱등성·"경기 없는 날 정상 종료" 유지.
- `.github/workflows/sync-postgame.yml`: review 스텝 `id: review`, 순위·forecast 스텝에 `if: steps.review.outputs.collected != '0'`. 커밋 스텝은 diff 가드로 항상 실행.
- `.github/workflows/sync-daily.yml`: 일정 갱신 다음에 `extract-kbo-review.mjs yesterday`(어제 잔여 백필) + `generate-starter-forecast.mjs`(아침 예측 최신화) 스텝 추가.

## 실행 검증 (KST 2026-07-18 저녁, 라이브)

- `extract-kbo-review.mjs` 1회차: **07.18 5경기 신규 수집**(신규 5 · 취소 0 · pending 0 · 스킵 0). `collected=5 pending=0`.
- 2회차: **신규 0 · 스킵 5**, "오늘 경기 전부 처리 완료 — 신규 없음" 즉시 종료. `collected=0 pending=0`. 파일 md5 재실행 전후 동일(멱등, 파일 미수정 확인).
- `extract-kbo-review.mjs yesterday`(=07.17): 이미 전부 기록 → **신규 0 · 스킵 5** 즉시 종료.
- `node --check` 전 파일 통과. 워크플로우 yml 표현식 육안 재검.

## 비고

- 라이브 실행으로 수집된 07.18 데이터는 이 코드 브랜치에 포함하지 않고 되돌림(데이터 커밋은 Actions 봇 담당). 브랜치는 코드+문서 변경만 담음.
