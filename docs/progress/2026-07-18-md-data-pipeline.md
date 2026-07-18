# 2026-07-18 MD 데이터 파이프라인 구현

`docs/dev-plans/md-data-pipeline.md` 스펙 구현. DB/서버 없이 GitHub Actions가 KBO 공개 페이지를 수집해 `docs/data/` md에 축적하는 검증 운영 단계 파이프라인.

## 구현

- 공통 모듈 `scripts/lib/kbo.mjs`: 브라우저 실행(고정 UA, 45s 타임아웃), KST 날짜 헬퍼(러너 UTC 대응), 팀코드 맵, md 테이블/섹션 멱등 upsert 헬퍼, `li.game-cont` 리더.
- 스크립트 6종: `extract-kbo-schedule` / `extract-kbo-preview`(예고) / `extract-kbo-review`(실제+박스스코어, 기존 starters 대체) / `extract-kbo-standings` / `extract-kbo-availability` / `generate-starter-forecast`.
- `docs/data/` 재편: `schedule/ starters/{actual,official,predicted}/ rotation/ standings/ availability/ games/ archive/`. 기존 파일 git mv.
- 워크플로우 3종: `sync-daily`(08:00) / `sync-preview`(09·12·15·18·21·23시, 15시 회차 availability) / `sync-postgame`(21:30~24:30 30분). `concurrency: data-sync`, `contents: write`, `workflow_dispatch`.
- `docs/data/README.md` AI 데이터 카탈로그(최중요 산출물) + 소스 계약/스키마 노트/백로그 갱신.

## 실행 검증 (KST 2026-07-18 저녁, 라이브)

- preview: 9경기 예고 수집, **07.19 롯데 김진욱 / 삼성 원태인** 확인. 예고 교체 변경 이력 동작.
- standings: 10팀, **1위 삼성** 확인 + 팀간 승패표.
- availability: 10팀 순회 성공(3팀 변동). `fnSearchChange` 직접 evaluate는 strict-mode 에러 → 팀 탭 앵커 클릭으로 해결.
- review 20260717: **4경기 end + 롯데@삼성 취소** 처리 확인. 실제 선발 + 박스스코어(투수 전원/타자) 수집. 재실행 멱등 확인.
- rotation 시드: actual(07.08·09·16·17) 기반 slots/pointers 생성("사람 검토 필요" 주석). forecast: 30개 예상 선발 생성, 포인터 auto/auto-hold 동작, 비교 컬럼(일치/불일치/예고대기) 갱신, 재실행 멱등 확인.

## 스펙과 달라진 점 / 발견

- **GameCenter 날짜 페이지 clamp**: 서비스 윈도우 밖 과거일을 가까운 유효일로 바꿔 응답. preview/review에 `g_dt===요청일` 필터 추가(스펙에 없던 방어). 과거 백필은 gameId 직접 REVIEW로만 가능.
- **올스타 브레이크**(07.10~15 경기 없음)로 최근 actual이 07.16·17 2일치뿐 → 시드용으로 07.08·09를 gameId 직접 REVIEW로 backfill.
- Register 팀 전환은 `fnSearchChange` evaluate 대신 앵커 클릭 + networkidle 대기.
- 예고 이름 보존: 경기 시작 후 today-pitcher가 비면 기존 예고 이름을 유지(빈값 덮어쓰기 방지).
- 이동한 과거 월(04/05/06) starters/schedule은 구 헤더 형식 유지(재생성 대상 아님).

## 남은 것

- Actions 러너(해외 IP) 접근 검증 후 push. rotation 시드 사람 확정. (backlog 참조)
