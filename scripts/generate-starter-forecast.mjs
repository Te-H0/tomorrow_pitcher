// 시스템 예상 선발 생성 → docs/data/starters/predicted/YYYY-MM.md + rotation/pointers.md 갱신
// 입력: rotation/slots.md + rotation/pointers.md + schedule + official + actual
// 로직: 어제 실제 선발로 포인터 자동 전진, 오늘~D+N 예상 선발 산출(포인터 슬롯 투수).
// 예측은 사후 수정하지 않는다(immutable). 공식/실제와의 차이는 "비교" 컬럼으로만 남긴다.
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

function nextSlotNumber(slotList, current) {
  const nums = slotList.map((s) => s.slot);
  if (!nums.length) return current;
  const idx = nums.indexOf(current);
  if (idx === -1) return nums[0];
  return nums[(idx + 1) % nums.length];
}

function pitcherAt(slotList, slotNo) {
  return slotList.find((s) => s.slot === slotNo)?.pitcher ?? "";
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

// 어제 실제 선발: actual/{yesterday month}.md
const yActual = await readFileOrEmpty(`${DATA_DIR}/starters/actual/${monthOf(yesterday)}.md`);
const yActualRows = parseTableRows(yActual, "원정 선발").filter((r) => r[1].startsWith(yesterday));
const yCancelRows = parseTableRows(yActual, "사유").filter((r) => r[1].startsWith(yesterday));

// 팀별 어제 실제 선발 { team: {gameId, starter} }
const yStarterByTeam = new Map();
for (const r of yActualRows) {
  // [날짜, gameId, 원정, 원정선발, 홈, 홈선발, 구장, 상태]
  yStarterByTeam.set(r[2], { gameId: r[1], starter: r[3] });
  yStarterByTeam.set(r[4], { gameId: r[1], starter: r[5] });
}
const yCancelTeams = new Set();
for (const r of yCancelRows) {
  yCancelTeams.add(r[2]);
  yCancelTeams.add(r[3]);
}

// --- 1) 포인터 자동 전진 ---------------------------------------------------
const stamp = kstStamp();
for (const [team, ptr] of pointers) {
  const slotList = slots.get(team) ?? [];
  const y = yStarterByTeam.get(team);
  if (y) {
    if (ptr.lastGame === y.gameId) continue; // 이미 반영됨(멱등)
    const expected = pitcherAt(slotList, ptr.nextSlot);
    if (expected && y.starter && expected === y.starter) {
      ptr.nextSlot = nextSlotNumber(slotList, ptr.nextSlot);
      ptr.lastGame = y.gameId;
      ptr.updatedAt = stamp;
      ptr.updatedBy = "auto";
      ptr.memo = "";
    } else {
      ptr.lastGame = y.gameId;
      ptr.updatedAt = stamp;
      ptr.updatedBy = "auto-hold";
      ptr.memo = `확인 필요: 예상(${expected || "-"}) != 실제(${y.starter || "-"})`;
    }
  } else if (yCancelTeams.has(team)) {
    ptr.updatedAt = stamp;
    ptr.updatedBy = "auto-hold";
    ptr.memo = "확인 필요: 어제 경기 취소";
  }
}

// pointers.md 재작성
function renderPointers(map) {
  const lines = [
    "# 팀별 로테이션 포인터",
    "",
    `마지막 갱신: ${stamp} · generate-starter-forecast.mjs (auto) / 수동 편집 병행`,
    "",
    "> 다음 선발 슬롯 포인터. auto=어제 실제와 일치해 전진, auto-hold=불일치/취소로 유지(사람 확인 필요).",
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
// 필요한 월의 schedule/official 로드(캐시)
const scheduleCache = new Map();
const officialCache = new Map();
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

function officialStarter(offRows, gameId, team) {
  const row = offRows.find((r) => r[1] === gameId);
  if (!row) return "";
  if (row[2] === team) return row[3];
  if (row[5] === team) return row[6];
  return "";
}

// 대상 날짜별 예측 행 산출
const predictedByMonth = new Map(); // month → rows[]
for (let off = 0; off <= horizon; off += 1) {
  const ymd = kstYmdOffset(off);
  const month = monthOf(ymd);
  const dateLabel = dateLabelFromYmd(ymd);
  const schedMonth = ymd.slice(0, 4) + "-" + ymd.slice(4, 6);
  const rows = await scheduleRows(schedMonth);
  const offRows = await officialRows(month);
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
      const slotNo = ptr.nextSlot;
      const predicted = pitcherAt(slotList, slotNo);
      if (!predicted) continue;
      const off2 = officialStarter(offRows, gameId, team);
      const compare = off2 ? (off2 === predicted ? "일치" : "불일치") : "예고대기";
      if (!predictedByMonth.has(month)) predictedByMonth.set(month, []);
      predictedByMonth.get(month).push({
        dateLabel, gameId, team, predicted, slotNo, compare,
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
    "> 로테이션 포인터 기반 예상 선발(SYSTEM_PREDICTED, 최하위 신뢰). 예측은 사후 수정하지 않으며 비교 컬럼으로만 검증한다.",
    "",
    "| 날짜 | gameId | 팀 | 예상 선발 | 근거 슬롯 | 생성 시각(KST) | 비교 |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) lines.push(`| ${r.join(" | ")} |`);
  return `${lines.join("\n")}\n`;
}

let totalPred = 0;
for (const [month, preds] of predictedByMonth) {
  const path = `${DATA_DIR}/starters/predicted/${month}.md`;
  const existing = parseTableRows(await readFileOrEmpty(path), PRED_SIG);
  const byKey = new Map();
  for (const r of existing) byKey.set(`${r[1]}|${r[2]}`, r); // gameId|team
  for (const p of preds) {
    const key = `${p.gameId}|${p.team}`;
    const prev = byKey.get(key);
    if (prev) {
      // immutable: 예상 선발/근거 슬롯/생성 시각 유지, 비교만 갱신
      byKey.set(key, [prev[0], prev[1], prev[2], prev[3], prev[4], prev[5], p.compare]);
    } else {
      byKey.set(key, [p.dateLabel, p.gameId, p.team, p.predicted, `슬롯 ${p.slotNo}`, stamp, p.compare]);
    }
  }
  const rows = [...byKey.values()].sort((a, b) => (a[1] === b[1] ? a[2].localeCompare(b[2]) : a[1].localeCompare(b[1])));
  await writeFileEnsured(path, renderPredicted(month, rows));
  totalPred += preds.length;
  console.log(`predicted/${month}.md: ${preds.length} team-forecasts upsert (total rows ${rows.length}).`);
}

if (totalPred === 0) {
  console.error(`No forecasts produced (오늘~D+${horizon} 일정 없음 또는 슬롯 미구성).`);
  process.exit(1);
}
console.log(`Forecast done for ${isoDate(today)} ~ D+${horizon}. Pointers updated.`);
