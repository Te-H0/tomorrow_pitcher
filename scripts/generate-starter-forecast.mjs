// 시스템 예상 선발 생성 → docs/data/starters/predicted/YYYY-MM.md + rotation/pointers.md 갱신
// 입력: rotation/slots.md + rotation/pointers.md + schedule + official + actual
// 로직:
//   1) 어제 실제 선발로 포인터 자동 전진/재정렬. 취소 경기는 예고 투수가 있으면 그 슬롯 유지(재정렬).
//   2) 오늘~D+N 예상 선발 산출 — 포인터에서 출발해 날짜 순서로 시뮬레이션 전진.
//      예고가 뜬 경기는 예고 투수 슬롯 기준으로 전진(예고 = 하루 빠른 정답지, 관측상 실제와 100% 일치).
//   3) 취소 확정 경기의 비교 컬럼을 "취소"로 보정(적중률 집계 제외, 예측 값은 보존).
// 예측 동결(Model B): 공식 예고가 뜨기 전까지는 현재 포인터로 갱신(재정렬 반영),
// 공식 예고 확인 시점에 동결. 동결 후에는 수정하지 않으며 "비교" 컬럼으로 적중을 기록한다.
import { readdir } from "node:fs/promises";
import {
  DATA_DIR,
  dateLabelFromYmd,
  isoDate,
  kstStamp,
  kstToday,
  kstYmdOffset,
  monthOf,
  parseTableRows,
  readFileOrEmpty,
  writeFileEnsured,
} from "./lib/kbo.mjs";

// 표시명 → KBO 팀코드 (gameId 계산용; 미래 경기는 schedule.aspx gameId가 비어있음)
const CODE_BY_NAME = {
  KT: "KT", LG: "LG", 삼성: "SS", KIA: "HT", 두산: "OB",
  롯데: "LT", 한화: "HH", NC: "NC", SSG: "SK", 키움: "WO",
};

const horizon = Number(process.argv[2] ?? 3); // 오늘~D+horizon
const today = kstToday();
const yesterday = kstYmdOffset(-1);

function gameIdOf(ymd, awayName, homeName) {
  const a = CODE_BY_NAME[awayName];
  const h = CODE_BY_NAME[homeName];
  if (!a || !h) return "";
  return `${ymd}${a}${h}0`;
}

// rotation/slots.md 파싱 → Map<team, [{slot, pitcher, status}]>
function parseSlots(content) {
  const map = new Map();
  let team = null;
  for (const line of content.split("\n")) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) {
      team = h[1].trim();
      map.set(team, []);
      continue;
    }
    if (team && line.trim().startsWith("|")) {
      const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      if (cells[0] === "슬롯" || /^-+$/.test(cells[0]) || cells[0] === "") continue;
      if (!/^\d+$/.test(cells[0])) continue;
      map.get(team).push({ slot: Number(cells[0]), pitcher: cells[1] || "", status: cells[2] || "" });
    }
  }
  for (const list of map.values()) list.sort((a, b) => a.slot - b.slot);
  return map;
}

// rotation/pointers.md 파싱 → Map<team, {nextSlot, lastGame, updatedAt, updatedBy, memo}>
const POINTER_SIG = "다음 슬롯";
function parsePointers(content) {
  const map = new Map();
  for (const cells of parseTableRows(content, POINTER_SIG)) {
    const [team, nextSlot, lastGame, updatedAt, updatedBy, memo] = cells;
    if (!team) continue;
    map.set(team, {
      nextSlot: Number(nextSlot) || 1,
      lastGame: lastGame || "",
      updatedAt: updatedAt || "",
      updatedBy: updatedBy || "",
      memo: memo || "",
    });
  }
  return map;
}

// --- 슬롯 상태 규칙 ---------------------------------------------------------
// ACTIVE / TEMPORARY = 예측 대상.
// INACTIVE(부상·이탈) / PENDING(대체 투수 미정) = 예측 제외.
// 투수 이름이 비었거나 "(부상 대체 투수)"처럼 괄호로 시작하는 플레이스홀더도 제외.
const FORECASTABLE_STATUSES = new Set(["ACTIVE", "TEMPORARY"]);

function isForecastable(slot) {
  if (!slot) return false;
  const name = (slot.pitcher ?? "").trim();
  if (!name || name.startsWith("(")) return false;
  // 상태 셀에 메모성 수식이 붙어도 첫 토큰만 본다.
  const status = (slot.status ?? "").trim().toUpperCase().split(/[^A-Z]/)[0];
  return FORECASTABLE_STATUSES.has(status);
}

// startSlot부터 순환하며 첫 번째 예측 가능 슬롯을 찾는다.
// 포인터가 INACTIVE/PENDING 슬롯을 가리키면 다음 유효 슬롯으로 건너뛰는 것이 목적.
// 유효 슬롯이 하나도 없으면 null (해당 팀 예측 생략, 에러 아님).
// 순회 횟수를 슬롯 수로 제한해 무한 루프를 막는다.
function resolveForecastSlot(slotList, startSlot) {
  if (!slotList.length) return null;
  let idx = slotList.findIndex((s) => s.slot === startSlot);
  if (idx === -1) idx = 0; // 포인터가 없는 슬롯을 가리키면 첫 슬롯부터 탐색
  for (let step = 0; step < slotList.length; step += 1) {
    const cand = slotList[(idx + step) % slotList.length];
    if (isForecastable(cand)) return cand.slot;
  }
  return null;
}

// current 다음의 예측 가능 슬롯(순환). 제외 슬롯은 건너뛴다.
// 유효 슬롯이 없으면 current를 그대로 둔다(전진 불가).
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

// 투수 이름으로 슬롯 번호를 찾는다. 상태(ACTIVE/TEMPORARY/INACTIVE)와 무관하게
// 슬롯 목록에 이름이 있으면 "로테이션에 아는 투수"로 본다. 없으면 null(콜업·땜빵).
// 재정렬(re-anchor)의 기준: 실제 선발이 아는 투수면 그 슬롯을 앵커로 삼는다.
function findSlotByPitcher(slotList, pitcherName) {
  const name = (pitcherName ?? "").trim();
  if (!name) return null;
  const hit = slotList.find((s) => (s.pitcher ?? "").trim() === name);
  return hit ? hit.slot : null;
}

// --- 입력 로드 -------------------------------------------------------------
const slotsContent = await readFileOrEmpty(`${DATA_DIR}/rotation/slots.md`);
const pointersContent = await readFileOrEmpty(`${DATA_DIR}/rotation/pointers.md`);
if (!slotsContent.trim() || !pointersContent.trim()) {
  console.error("rotation/slots.md 또는 pointers.md 가 비어있음. 시드가 필요합니다.");
  process.exit(1);
}
const slots = parseSlots(slotsContent);
const pointers = parsePointers(pointersContent);

// 필요한 월의 schedule/official/취소 확정 gameId 로드(캐시)
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

// 어제 실제 선발: actual/{yesterday month}.md
const yActual = await readFileOrEmpty(`${DATA_DIR}/starters/actual/${monthOf(yesterday)}.md`);
const yActualRows = parseTableRows(yActual, "원정 선발").filter((r) => r[1].startsWith(yesterday));
const yCancelRows = parseTableRows(yActual, "사유").filter((r) => r[1].startsWith(yesterday));

// 팀별 어제 실제 선발 { team: {gameId, starter} } / 어제 취소 경기 gameId
const yStarterByTeam = new Map();
for (const r of yActualRows) {
  // [날짜, gameId, 원정, 원정선발, 홈, 홈선발, 구장, 상태]
  yStarterByTeam.set(r[2], { gameId: r[1], starter: r[3] });
  yStarterByTeam.set(r[4], { gameId: r[1], starter: r[5] });
}
const yCancelByTeam = new Map();
for (const r of yCancelRows) {
  yCancelByTeam.set(r[2], r[1]);
  yCancelByTeam.set(r[3], r[1]);
}

// --- 1) 포인터 자동 전진 ---------------------------------------------------
const stamp = kstStamp();
for (const [team, ptr] of pointers) {
  const slotList = slots.get(team) ?? [];
  const y = yStarterByTeam.get(team);
  if (y) {
    if (ptr.lastGame === y.gameId) continue; // 이미 반영됨(멱등)
    // 포인터가 제외 슬롯(INACTIVE/PENDING)을 가리키면 실제 예측에 쓰인 슬롯 기준으로 비교한다.
    const effSlot = resolveForecastSlot(slotList, ptr.nextSlot);
    const expected = effSlot == null ? "" : pitcherAt(slotList, effSlot);
    // 규칙: 포인터는 "가장 최근에 나온, 로테이션에 아는 투수"를 따라간다.
    // 실제 선발이 슬롯 목록에 있으면(적중이든 순서 빗나감이든) 그 투수 슬롯 기준으로 재정렬한다.
    // 없으면(콜업·땜빵) 보류하고 사람 확인을 기다린다. 이후 아는 투수가 다시 나오면 그때 자동 복구.
    const anchorSlot = findSlotByPitcher(slotList, y.starter);
    if (anchorSlot != null) {
      ptr.nextSlot = nextSlotNumber(slotList, anchorSlot);
      ptr.lastGame = y.gameId;
      ptr.updatedAt = stamp;
      if (expected && expected === y.starter) {
        // 예측 적중: 기존 정상 전진.
        ptr.updatedBy = "auto";
        ptr.memo = "";
      } else {
        // 예측은 빗나갔지만 아는 투수 → 그 투수 기준으로 재정렬(자동 교정).
        ptr.updatedBy = "auto-reanchor";
        ptr.memo = `재정렬: 실제 ${y.starter}(슬롯 ${anchorSlot}) 기준으로 포인터 이동`;
      }
    } else {
      // 로테이션에 없는 투수 → 보류. slots.md에 반영되면 다음부터 아는 투수로 처리됨.
      ptr.lastGame = y.gameId;
      ptr.updatedAt = stamp;
      ptr.updatedBy = "auto-hold";
      ptr.memo = `확인 필요: ${y.starter || "-"} 로테이션 미등록 선발`;
    }
  } else if (yCancelByTeam.has(team)) {
    const cancelGameId = yCancelByTeam.get(team);
    if (ptr.lastGame === cancelGameId) continue; // 이미 반영됨(멱등)
    // 예고까지 났던 경기가 취소되면 그 투수는 등판하지 않았다 → 여전히 다음 차례.
    // 예고 투수가 로테이션에 있으면 그 슬롯으로 재정렬해 취소 정보를 잃지 않는다.
    const offP = officialStarter(await officialRows(monthOf(yesterday)), cancelGameId, team);
    const offSlot = findSlotByPitcher(slotList, offP);
    if (offSlot != null) {
      ptr.nextSlot = offSlot;
      ptr.lastGame = cancelGameId;
      ptr.updatedAt = stamp;
      ptr.updatedBy = "auto-reanchor";
      ptr.memo = `취소 경기 예고 ${offP}(슬롯 ${offSlot}) 유지 — 다음 차례로 재정렬`;
    } else if (ptr.updatedBy !== "manual") {
      // 예고 없는 취소는 새 정보가 없다 — 수동 시드는 보존하고 자동 상태만 확인 필요로 표시.
      ptr.lastGame = cancelGameId; // 같은 취소를 재처리하지 않도록 멱등 가드
      ptr.updatedAt = stamp;
      ptr.updatedBy = "auto-hold";
      ptr.memo = "확인 필요: 어제 경기 취소";
    }
  }
}

// pointers.md 재작성
function renderPointers(map) {
  const lines = [
    "# 팀별 로테이션 포인터",
    "",
    `마지막 갱신: ${stamp} · generate-starter-forecast.mjs (auto) / 수동 편집 병행`,
    "",
    "> 다음 선발 슬롯 포인터. auto=예측 적중 전진, auto-reanchor=아는 로테이션 투수(실제 또는 취소 경기 예고) 기준 재정렬, auto-hold=로테이션 미등록 투수·예고 없는 취소로 유지(사람 확인 필요).",
    "",
    "| 팀 | 다음 슬롯 | 마지막 반영 경기 | 갱신 시각(KST) | 갱신 주체 | 메모 |",
    "|---|---|---|---|---|---|",
  ];
  for (const [team, p] of map) {
    lines.push(`| ${team} | ${p.nextSlot} | ${p.lastGame} | ${p.updatedAt} | ${p.updatedBy} | ${p.memo} |`);
  }
  return `${lines.join("\n")}\n`;
}
await writeFileEnsured(`${DATA_DIR}/rotation/pointers.md`, renderPointers(pointers));

// --- 2) 오늘~D+N 예상 선발 -------------------------------------------------
// 팀별 작업 슬롯: 포인터에서 출발해 날짜 순서로 시뮬레이션 전진한다.
// - 예고가 뜬 경기: 예고 투수 슬롯 기준으로 전진(예고 = 하루 빠른 정답지). 모르는 투수면 유지.
// - 취소 확정 경기: 예고 투수가 여전히 다음 차례 → 그 슬롯으로 이동(전진 없음).
// - 그 외 미래 경기: 예측 슬롯이 맞았다고 가정하고 전진(로테이션 순환 가정).
const curSlotByTeam = new Map();
for (const [team, ptr] of pointers) curSlotByTeam.set(team, ptr.nextSlot);

// 대상 날짜별 예측 행 산출
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
      const ptr = pointers.get(team);
      if (!ptr) continue;
      // 포인터가 부상 이탈(INACTIVE)·미정(PENDING) 슬롯을 가리키면 다음 유효 슬롯으로 건너뛴다.
      // 유효 슬롯이 하나도 없는 팀은 예측을 생략한다(에러 아님).
      const slotNo = resolveForecastSlot(slotList, curSlotByTeam.get(team) ?? ptr.nextSlot);
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
      if (!predictedByMonth.has(month)) predictedByMonth.set(month, []);
      predictedByMonth.get(month).push({
        dateLabel, gameId, team, predicted, slotNo, official: off2, canceled,
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
    "> 로테이션 포인터 기반 예상 선발(SYSTEM_PREDICTED, 최하위 신뢰). 공식 예고 전까지 갱신되고 예고 확인 시 동결, 비교 컬럼으로 적중을 검증한다. 취소 확정 경기는 비교=취소로 집계에서 제외.",
    "",
    "| 날짜 | gameId | 팀 | 예상 선발 | 근거 슬롯 | 생성 시각(KST) | 비교 |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) lines.push(`| ${r.join(" | ")} |`);
  return `${lines.join("\n")}\n`;
}

// 동결 규칙(Model B): 공식 예고가 확인된 시점(비교=일치/불일치) 또는 취소 확정 시점에 예측을 동결한다.
// 그 전(비교=예고대기)까지는 현재 포인터 기준으로 계속 갱신 → 포인터 재정렬이 미래 예측에 반영된다.
// 동결 후에는 포인터가 더 움직여도 그 행을 건드리지 않아 적중률 기록이 보존된다.
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
    // 미동결(예고대기) 또는 신규 → 현재 포인터 예측으로 갱신. 취소/공식 예고가 있으면 이 값으로 동결.
    const compare = p.canceled
      ? "취소"
      : p.official
        ? (p.official === p.predicted ? "일치" : "불일치")
        : "예고대기";
    // 예측 값이 그대로면 생성 시각 유지(불필요한 diff 방지), 바뀌면 갱신.
    const genAt = prev && prev[3] === p.predicted ? prev[5] : stamp;
    byKey.set(key, [p.dateLabel, p.gameId, p.team, p.predicted, `슬롯 ${p.slotNo}`, genAt, compare]);
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
  console.error(`No forecasts produced (오늘~D+${horizon} 일정 없음 또는 슬롯 미구성).`);
  process.exit(1);
}
console.log(`Forecast done for ${isoDate(today)} ~ D+${horizon}. Pointers updated.`);
