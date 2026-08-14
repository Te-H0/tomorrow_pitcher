// 시스템 예상 선발 생성 → docs/data/starters/predicted/YYYY-MM.md + rotation/slots.md·pointers.md(파생 아티팩트)
// 입력: 관측 데이터(actual + official + availability) + rotation/overrides.md + schedule
// 로직(2026-08-14 전환 — 순서 저장 폐기, 관측 파생):
//   1) lib/rotation.mjs deriveRotation()으로 팀별 로테이션을 매 실행 파생.
//      슬롯 1 = 가장 오래 쉰 투수 = 다음 차례. 어제 결과 반영·재정렬이 파생에 자동 포함되므로
//      별도 포인터 전진/재정렬 로직이 없다. 사람 보정은 rotation/overrides.md로만.
//   2) 오늘~D+N 예상 선발 산출 — 슬롯 1에서 출발해 날짜 순서로 시뮬레이션 전진.
//      예고가 뜬 경기는 예고 투수 슬롯 기준으로 전진(예고 = 하루 빠른 정답지, 관측상 실제와 100% 일치).
//      직전 3경기+ 연속 취소 후 첫 경기는 "저신뢰(재개 첫날)" 표기(재배치 가능성).
//   3) 취소 확정 경기의 비교 컬럼을 "취소"로 보정(적중률 집계 제외, 예측 값은 보존).
// 예측 동결(Model B): 공식 예고가 뜨기 전까지는 현재 파생 순서로 갱신,
// 공식 예고 확인 시점에 동결. 동결 후에는 수정하지 않으며 "비교" 컬럼으로 적중을 기록한다.
import { readdir } from "node:fs/promises";
import {
  DATA_DIR,
  dateLabelFromYmd,
  daysBetween,
  isoDate,
  kstStamp,
  kstToday,
  kstYmdOffset,
  monthOf,
  parseTableRows,
  readFileOrEmpty,
  writeFileEnsured,
  ymdOffset,
} from "./lib/kbo.mjs";
import { deriveRotation, MAX_REST_DAYS, POOL_WINDOW_DAYS } from "./lib/rotation.mjs";

// 표시명 → KBO 팀코드 (gameId 계산용; 미래 경기는 schedule.aspx gameId가 비어있음)
const CODE_BY_NAME = {
  KT: "KT", LG: "LG", 삼성: "SS", KIA: "HT", 두산: "OB",
  롯데: "LT", 한화: "HH", NC: "NC", SSG: "SK", 키움: "WO",
};

const horizon = Number(process.argv[2] ?? 3); // 오늘~D+horizon
const today = kstToday();

function gameIdOf(ymd, awayName, homeName) {
  const a = CODE_BY_NAME[awayName];
  const h = CODE_BY_NAME[homeName];
  if (!a || !h) return "";
  return `${ymd}${a}${h}0`;
}

// --- 슬롯 헬퍼 (파생 순서 기준) --------------------------------------------
// ACTIVE / TEMPORARY = 예측 대상 (파생 결과에는 이 둘만 존재).
function isForecastable(slot) {
  return Boolean(slot && (slot.pitcher ?? "").trim());
}

// startSlot부터 순환하며 첫 번째 예측 가능 슬롯을 찾는다. 유효 슬롯이 없으면 null.
function resolveForecastSlot(slotList, startSlot) {
  if (!slotList.length) return null;
  let idx = slotList.findIndex((s) => s.slot === startSlot);
  if (idx === -1) idx = 0;
  for (let step = 0; step < slotList.length; step += 1) {
    const cand = slotList[(idx + step) % slotList.length];
    if (isForecastable(cand)) return cand.slot;
  }
  return null;
}

// current 다음의 예측 가능 슬롯(순환).
function nextSlotNumber(slotList, current) {
  if (!slotList.length) return current;
  const idx = slotList.findIndex((s) => s.slot === current);
  if (idx === -1) return resolveForecastSlot(slotList, current) ?? current;
  for (let step = 1; step <= slotList.length; step += 1) {
    const cand = slotList[(idx + step) % slotList.length];
    if (isForecastable(cand)) return cand.slot;
  }
  return current;
}

function pitcherAt(slotList, slotNo) {
  return slotList.find((s) => s.slot === slotNo)?.pitcher ?? "";
}

function findSlotByPitcher(slotList, pitcherName) {
  const name = (pitcherName ?? "").trim();
  if (!name) return null;
  const hit = slotList.find((s) => (s.pitcher ?? "").trim() === name);
  return hit ? hit.slot : null;
}

// --- 로테이션 파생 ----------------------------------------------------------
const { rotation: slots, exclusions } = await deriveRotation(today, { horizon });
// 파생 건전성 가드: 수집기가 죽어 풀이 빈약해지면 예측을 만들지 않는다.
// 빈약한 파생으로 만든 예측이 동결되면 적중률 기록이 영구 오염되기 때문(잘못된 데이터 < 무데이터).
const MIN_POOL_PER_TEAM = 3;
const degraded = [...slots].filter(([, l]) => l.filter(isForecastable).length < MIN_POOL_PER_TEAM).map(([t]) => t);
if (slots.size < 8 || degraded.length > 2) {
  console.error(
    `로테이션 파생이 비정상적으로 빈약합니다(팀 ${slots.size}개, ${MIN_POOL_PER_TEAM}인 미만: ${degraded.join(", ") || "-"}). ` +
    "수집(actual/official) 상태 점검 필요 — 예측·아티팩트를 생성하지 않습니다.",
  );
  process.exit(1);
}
const stamp = kstStamp();

// slots.md 아티팩트: 사람 확인용 파생 결과 스냅샷 (편집 금지 — 보정은 overrides.md)
function renderSlots() {
  const lines = [
    "# 팀별 로테이션 슬롯 (자동 파생)",
    "",
    `마지막 갱신: ${stamp} · generate-starter-forecast.mjs (관측 파생 — 편집하지 마세요)`,
    "",
    `> 최근 ${POOL_WINDOW_DAYS}일 실제 선발 + 예고 + 등록/말소에서 매 실행 파생. 슬롯 1 = 가장 오래 쉰 투수 = 다음 차례.`,
    `> 마지막 등판 ${MAX_REST_DAYS}일 초과·말소 후 미등록 투수는 자동 제외. 사람 보정은 rotation/overrides.md에서.`,
    "",
  ];
  for (const [team, list] of [...slots].sort((a, b) => a[0].localeCompare(b[0], "ko"))) {
    lines.push(`## ${team}`, "", "| 슬롯 | 투수 | 상태 | 마지막 등판 | 메모 |", "|---|---|---|---|---|");
    for (const s of list) {
      const last = s.lastStart ? `${s.lastStart.slice(4, 6)}.${s.lastStart.slice(6, 8)}` : "-";
      lines.push(`| ${s.slot} | ${s.pitcher} | ${s.status} | ${last} | ${s.memo || ""} |`);
    }
    const excluded = [...exclusions].filter(([k]) => k.startsWith(`${team}|`));
    if (excluded.length) {
      lines.push("", `제외: ${excluded.map(([k, v]) => `${k.split("|")[1]}(${v})`).join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
await writeFileEnsured(`${DATA_DIR}/rotation/slots.md`, renderSlots());

// pointers.md 아티팩트: 팀별 다음 차례 현황 (파생 결과 요약, 편집 금지)
function renderPointers() {
  const lines = [
    "# 팀별 다음 선발 현황 (자동 파생)",
    "",
    `마지막 갱신: ${stamp} · generate-starter-forecast.mjs (관측 파생 — 편집하지 마세요)`,
    "",
    "> 슬롯 순서는 관측에서 매 실행 파생되므로 별도 포인터 상태가 없다. 보정은 rotation/overrides.md에서.",
    "",
    "| 팀 | 다음 예상 | 마지막 등판 | 휴식일(오늘 기준) | 상태 |",
    "|---|---|---|---|---|",
  ];
  for (const [team, list] of [...slots].sort((a, b) => a[0].localeCompare(b[0], "ko"))) {
    const next = list.find(isForecastable);
    if (!next) continue;
    const last = next.lastStart ? `${next.lastStart.slice(4, 6)}.${next.lastStart.slice(6, 8)}` : "-";
    const rest = next.lastStart ? `${daysBetween(next.lastStart, today)}일` : "-";
    lines.push(`| ${team} | ${next.pitcher} | ${last} | ${rest} | ${next.status} |`);
  }
  return lines.join("\n");
}
await writeFileEnsured(`${DATA_DIR}/rotation/pointers.md`, renderPointers());

// --- 입력 로드 (schedule / official / 취소) ---------------------------------
const scheduleCache = new Map();
const officialCache = new Map();
const cancelCache = new Map(); // month → Set<gameId> (actual 파일의 취소/노게임 섹션)
async function scheduleRows(month) {
  if (!scheduleCache.has(month)) {
    scheduleCache.set(month, parseTableRows(await readFileOrEmpty(`${DATA_DIR}/schedule/${month}.md`), "gameId"));
  }
  return scheduleCache.get(month);
}
async function officialRows(month) {
  if (!officialCache.has(month)) {
    officialCache.set(month, parseTableRows(await readFileOrEmpty(`${DATA_DIR}/starters/official/${month}.md`), "원정 예고선발"));
  }
  return officialCache.get(month);
}
async function canceledIds(month) {
  if (!cancelCache.has(month)) {
    const rows = parseTableRows(await readFileOrEmpty(`${DATA_DIR}/starters/actual/${month}.md`), "사유");
    cancelCache.set(month, new Set(rows.map((r) => r[1]).filter(Boolean)));
  }
  return cancelCache.get(month);
}

function officialStarter(offRows, gameId, team) {
  const row = offRows.find((r) => r[1] === gameId);
  if (!row) return "";
  if (row[2] === team) return row[3];
  if (row[5] === team) return row[6];
  return "";
}

// --- 재개 첫날 판정 ---------------------------------------------------------
// 해당 팀의 직전 경기들이 3경기 이상 연속 취소였으면 그 다음 첫 경기는 "재개 첫날".
// 연속 취소·휴식 뒤에는 팀이 로테이션을 재배치할 수 있어 순환 가정의 신뢰가 낮다
// (2026-08-09 결정). 예측은 내되 근거 슬롯에 저신뢰를 표기한다.
const RESUME_STREAK_MIN = 3;
const RESUME_LOOKBACK_DAYS = 14;
async function isResumeDay(team, ymd) {
  let streak = 0;
  for (let back = 1; back <= RESUME_LOOKBACK_DAYS; back += 1) {
    const d = ymdOffset(ymd, -back);
    const month = monthOf(d);
    const dayLabel = `${d.slice(4, 6)}.${d.slice(6, 8)}`;
    const row = (await scheduleRows(month)).find(
      (r) => r[0] && r[0].startsWith(dayLabel) && (r[2] === team || r[3] === team),
    );
    if (!row) continue; // 경기 없는 날(월요일 등)은 건너뛴다.
    const gameId = row[6] || gameIdOf(d, row[2], row[3]);
    if (gameId && (await canceledIds(month)).has(gameId)) {
      streak += 1;
      continue;
    }
    break; // 취소가 아닌 경기(정상 소화 또는 미래 미확정) → 연속 취소 구간 종료.
  }
  return streak >= RESUME_STREAK_MIN;
}

// --- 2) 오늘~D+N 예상 선발 -------------------------------------------------
// 팀별 작업 슬롯: 슬롯 1(가장 오래 쉰 투수)에서 출발해 날짜 순서로 시뮬레이션 전진한다.
// - 예고가 뜬 경기: 예고 투수 슬롯 기준으로 전진(예고 = 하루 빠른 정답지). 모르는 투수면 유지.
// - 취소 확정 경기: 예고 투수가 여전히 다음 차례 → 그 슬롯으로 이동(전진 없음).
// - 그 외 미래 경기: 예측 슬롯이 맞았다고 가정하고 전진(로테이션 순환 가정).
const curSlotByTeam = new Map();
for (const [team, list] of slots) {
  const first = resolveForecastSlot(list, 1);
  if (first != null) curSlotByTeam.set(team, first);
}

const predictedByMonth = new Map(); // month → rows[]
for (let off = 0; off <= horizon; off += 1) {
  const ymd = kstYmdOffset(off);
  const month = monthOf(ymd);
  const dateLabel = dateLabelFromYmd(ymd);
  const rows = await scheduleRows(month);
  const offRows = await officialRows(month);
  const canceledSet = await canceledIds(month);
  for (const r of rows) {
    // schedule row: [날짜, 시간, 원정, 홈, 구장, 상태, gameId]
    if (!r[0] || !r[0].startsWith(`${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`)) continue;
    const away = r[2];
    const home = r[3];
    const gameId = r[6] || gameIdOf(ymd, away, home);
    if (!gameId) continue;
    for (const team of [away, home]) {
      const slotList = slots.get(team) ?? [];
      if (!curSlotByTeam.has(team)) continue; // 유효 슬롯이 없는 팀은 예측 생략(에러 아님)
      const slotNo = resolveForecastSlot(slotList, curSlotByTeam.get(team));
      const off2 = officialStarter(offRows, gameId, team);
      const offSlot = findSlotByPitcher(slotList, off2);
      const canceled = canceledSet.has(gameId);
      // 다음 경기일용 슬롯 전진 (예측 기록 여부와 무관하게 정보는 반영한다)
      if (canceled) {
        // 취소 경기는 투수가 등판하지 않았으므로 전진하지 않는다(연속 취소 시 슬롯 유지는 의도된 동작).
        if (offSlot != null) curSlotByTeam.set(team, offSlot);
      } else if (off2) {
        if (offSlot != null) curSlotByTeam.set(team, nextSlotNumber(slotList, offSlot));
      } else if (slotNo != null) {
        curSlotByTeam.set(team, nextSlotNumber(slotList, slotNo));
      }
      if (slotNo == null) continue;
      const predicted = pitcherAt(slotList, slotNo);
      if (!predicted) continue;
      const resume = await isResumeDay(team, ymd);
      if (!predictedByMonth.has(month)) predictedByMonth.set(month, []);
      predictedByMonth.get(month).push({
        dateLabel, gameId, team, predicted, slotNo, official: off2, canceled, resume,
      });
    }
  }
}

// predicted/YYYY-MM.md upsert (immutable: 기존 예측 유지, 비교만 갱신)
const PRED_SIG = "예상 선발";
function renderPredicted(month, rows) {
  const lines = [
    `# ${month} KBO 시스템 예상 선발`,
    "",
    `마지막 갱신: ${stamp} · generate-starter-forecast.mjs`,
    "",
    "> 관측 파생 로테이션 기반 예상 선발(SYSTEM_PREDICTED, 최하위 신뢰). 공식 예고 전까지 갱신되고 예고 확인 시 동결, 비교 컬럼으로 적중을 검증한다. 취소 확정 경기는 비교=취소로 집계에서 제외.",
    "",
    "| 날짜 | gameId | 팀 | 예상 선발 | 근거 슬롯 | 생성 시각(KST) | 비교 |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) lines.push(`| ${r.join(" | ")} |`);
  return `${lines.join("\n")}\n`;
}

// 동결 규칙(Model B): 공식 예고가 확인된 시점(비교=일치/불일치) 또는 취소 확정 시점에 예측을 동결한다.
// 그 전(비교=예고대기)까지는 파생 순서 기준으로 계속 갱신. 동결 후에는 그 행을 건드리지 않아
// 적중률 기록이 보존된다.
const FROZEN_COMPARE = new Set(["일치", "불일치", "취소"]);
let totalPred = 0;
for (const [month, preds] of predictedByMonth) {
  const path = `${DATA_DIR}/starters/predicted/${month}.md`;
  const existing = parseTableRows(await readFileOrEmpty(path), PRED_SIG);
  const byKey = new Map();
  for (const r of existing) byKey.set(`${r[1]}|${r[2]}`, r); // gameId|team
  for (const p of preds) {
    const key = `${p.gameId}|${p.team}`;
    const prev = byKey.get(key);
    // 이미 동결된 행은 그대로 둔다.
    if (prev && FROZEN_COMPARE.has(prev[6])) continue;
    // 미동결(예고대기) 또는 신규 → 현재 파생 예측으로 갱신. 취소/공식 예고가 있으면 이 값으로 동결.
    const compare = p.canceled
      ? "취소"
      : p.official
        ? (p.official === p.predicted ? "일치" : "불일치")
        : "예고대기";
    // 예측 값이 그대로면 생성 시각 유지(불필요한 diff 방지), 바뀌면 갱신.
    const genAt = prev && prev[3] === p.predicted ? prev[5] : stamp;
    const slotLabel = p.resume ? `슬롯 ${p.slotNo} · 저신뢰(재개 첫날)` : `슬롯 ${p.slotNo}`;
    byKey.set(key, [p.dateLabel, p.gameId, p.team, p.predicted, slotLabel, genAt, compare]);
  }
  const rows = [...byKey.values()].sort((a, b) => (a[1] === b[1] ? a[2].localeCompare(b[2]) : a[1].localeCompare(b[1])));
  await writeFileEnsured(path, renderPredicted(month, rows));
  totalPred += preds.length;
  console.log(`predicted/${month}.md: ${preds.length} team-forecasts upsert (total rows ${rows.length}).`);
}

// --- 3) 취소 보정 -----------------------------------------------------------
// 이미 동결(일치/불일치)됐거나 예고대기로 남은 행이라도 경기가 취소로 확정되면
// 비교를 "취소"로 바꿔 적중률 집계에서 제외한다. 예측 값 자체는 보존한다.
// 예측 윈도우 밖의 과거 월 파일도 함께 보정한다(멱등).
const predDir = `${DATA_DIR}/starters/predicted`;
let cancelFixed = 0;
for (const file of (await readdir(predDir).catch(() => [])).sort()) {
  const m = file.match(/^(\d{4}-\d{2})\.md$/);
  if (!m) continue;
  const month = m[1];
  const canceledSet = await canceledIds(month);
  if (canceledSet.size === 0) continue;
  const path = `${predDir}/${file}`;
  const rows = parseTableRows(await readFileOrEmpty(path), PRED_SIG);
  let changed = false;
  for (const r of rows) {
    if (canceledSet.has(r[1]) && r[6] !== "취소") {
      r[6] = "취소";
      changed = true;
      cancelFixed += 1;
    }
  }
  if (changed) await writeFileEnsured(path, renderPredicted(month, rows));
}
if (cancelFixed > 0) console.log(`취소 보정: ${cancelFixed}행의 비교를 "취소"로 변경.`);

if (totalPred === 0) {
  console.error(`No forecasts produced (오늘~D+${horizon} 일정 없음 또는 관측 미비).`);
  process.exit(1);
}
console.log(`Forecast done for ${isoDate(today)} ~ D+${horizon}. Rotation derived from observations.`);
