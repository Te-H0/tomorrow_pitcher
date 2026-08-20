// 공식 예고 수집이 "조용히" 멈춘 걸 잡아내는 헬스체크.
// extract-kbo-preview.mjs는 예고 0건을 정상(no-op)으로 넘긴다 — 경기 없는 날과
// 예고 발표 전 회차가 매일 섞여 있어서다. 그 대가로, KBO가 start_ck/li.game-cont
// 구조를 바꾸면 수집이 영원히 0건인 채 아무도 모르게 통과할 수 있다.
// 그래서 사후 검증으로 막는다: 이미 '종료'된 경기는 예고가 반드시 발표됐어야 하므로,
// 종료 경기 gameId가 official 예고 표에 없으면 수집이 깨진 것이다.
// 인자 생략 시 어제(KST). sync-daily 아침 회차에서 하루 한 번 돈다.
import {
  DATA_DIR,
  dateLabelFromYmd,
  kstYmdOffset,
  monthOf,
  parseTableRows,
  readFileOrEmpty,
} from "./lib/kbo.mjs";

const arg = process.argv[2];
if (arg && !/^\d{8}$/.test(arg)) {
  console.error("Usage: node scripts/check-preview-health.mjs [YYYYMMDD]");
  process.exit(1);
}
const ymd = arg || kstYmdOffset(-1);
const month = monthOf(ymd);
const label = dateLabelFromYmd(ymd);

const schedule = parseTableRows(
  await readFileOrEmpty(`${DATA_DIR}/schedule/${month}.md`),
  "구장",
);
// 상태 '종료' + gameId가 찍힌 경기만. 취소/예정/미정은 예고가 없을 수 있어 판단 근거가 안 된다.
const finished = schedule
  .filter((r) => r[0] === label && r[5] === "종료" && r[6])
  .map((r) => r[6]);

if (finished.length === 0) {
  console.log(`${label}: 종료된 경기 없음 — 검증 대상 아님. skip.`);
  process.exit(0);
}

const announced = new Set(
  parseTableRows(
    await readFileOrEmpty(`${DATA_DIR}/starters/official/${month}.md`),
    "원정 예고선발",
  ).map((r) => r[1]),
);
const missing = finished.filter((id) => !announced.has(id));

if (missing.length > 0) {
  console.error(
    `${label}: 종료 ${finished.length}경기 중 ${missing.length}경기의 공식 예고가 없다 (${missing.join(", ")}). ` +
      "예고 수집이 조용히 실패하고 있을 수 있다 — extract-kbo-preview.mjs의 GameCenter 파싱 점검 필요.",
  );
  process.exit(1);
}

console.log(`${label}: 종료 ${finished.length}경기 모두 공식 예고 확보. OK.`);
