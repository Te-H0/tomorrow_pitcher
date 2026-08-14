// 백테스트: 슬롯 모델(실운영 기록) vs 관측 파생 모델(배포 경로), lead time(D+1~3)별 적중률 비교.
//
// 목적: 수동 슬롯 모델 → 관측 파생 모델 전환의 근거 수치. 파생 모델은 별도 재현 코드가 아니라
//       배포되는 lib/rotation.mjs deriveRotation()을 as-of 옵션으로 직접 호출해 측정한다
//       (측정 대상 = 배포 경로. 상수/규칙이 바뀌면 백테스트도 자동으로 같은 것을 잰다).
//
// 방법:
// - 기준선(슬롯 모델): git 히스토리에서 각 생성일 g의 09:05 KST 이전 마지막 커밋에 기록된
//   predicted/*.md → 그 시점의 t=g+L 예측. 즉 "실제로 운영된 시스템"의 lead별 성적.
// - 파생 모델: deriveRotation(g, {actualThrough: g-1, knownBy: g 09:00}) 로 g 아침 시점 재현 후
//   프로덕션과 같은 규칙으로 g→t 슬롯 순환 시뮬레이션(그 시점에 알려진 예고는 앵커로 사용,
//   미래 취소는 그 시점에 알 수 없으므로 예정 경기는 모두 열린다고 가정).
// - 정답: actual 선발(취소 경기 제외). 신규 편입 투수(관측 이력 없음)는 두 모델 다 못 맞히는
//   구조적 한계로 동일하게 불일치 처리.
//
// 사용: node scripts/backtest-restday-forecast.mjs [시작YMD] [끝YMD]  (기본 20260718~어제)
import { execSync } from "node:child_process";
import {
  DATA_DIR,
  TEAM_NAME_BY_CODE,
  kstYmdOffset,
  monthsCovering,
  parseTableRows,
  readFileOrEmpty,
  ymdFromDateCell,
  ymdOffset,
} from "./lib/kbo.mjs";
import { deriveRotation } from "./lib/rotation.mjs";

const CODE_BY_NAME = Object.fromEntries(Object.entries(TEAM_NAME_BY_CODE).map(([code, name]) => [name, code]));

const START = process.argv[2] ?? "20260718";
const END = process.argv[3] ?? kstYmdOffset(-1);
const LEADS = [1, 2, 3];

function* ymdRange(a, b) {
  for (let d = a; d <= b; d = ymdOffset(d, 1)) yield d;
}

// --- HEAD 기준 정답/일정/예고 로드 ------------------------------------------
const months = monthsCovering(START, ymdOffset(END, 3));
const canceled = new Set();
const officials = []; // {ymd, gameId, team, starter, firstSeen("YYYYMMDDHHmm")}
const schedule = []; // {ymd, gameId, away, home}
const actualByGameTeam = new Map(); // `${gameId}|${team}` → starter
for (const month of months) {
  const act = await readFileOrEmpty(`${DATA_DIR}/starters/actual/${month}.md`);
  for (const r of parseTableRows(act, "원정 선발")) {
    if (!ymdFromDateCell(r[0], month)) continue;
    if (r[3]) actualByGameTeam.set(`${r[1]}|${r[2]}`, r[3]);
    if (r[5]) actualByGameTeam.set(`${r[1]}|${r[4]}`, r[5]);
  }
  for (const r of parseTableRows(act, "사유")) if (r[1]) canceled.add(r[1]);
  const off = await readFileOrEmpty(`${DATA_DIR}/starters/official/${month}.md`);
  for (const r of parseTableRows(off, "원정 예고선발")) {
    const ymd = ymdFromDateCell(r[0], month);
    if (!ymd) continue;
    const m = (r[8] || "").match(/^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/);
    const firstSeen = m ? `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}` : "";
    if (r[3]) officials.push({ ymd, gameId: r[1], team: r[2], starter: r[3], firstSeen });
    if (r[6]) officials.push({ ymd, gameId: r[1], team: r[5], starter: r[6], firstSeen });
  }
  const sch = await readFileOrEmpty(`${DATA_DIR}/schedule/${month}.md`);
  for (const r of parseTableRows(sch, "gameId")) {
    const ymd = ymdFromDateCell(r[0], month);
    if (!ymd) continue;
    const gameId = r[6] || `${ymd}${CODE_BY_NAME[r[2]] ?? ""}${CODE_BY_NAME[r[3]] ?? ""}0`;
    schedule.push({ ymd, gameId, away: r[2], home: r[3] });
  }
}

// --- 파생 모델: g 아침 재현 + 프로덕션 규칙 시뮬레이션 -----------------------
// generate-starter-forecast.mjs의 순환 규칙과 동일: 슬롯 1에서 출발, 예고 앵커 시 그 슬롯 다음으로,
// 그 외에는 예측 슬롯이 맞았다고 가정하고 전진.
function simulatePrediction(rotation, g, t, team) {
  const slotList = rotation.get(team) ?? [];
  if (!slotList.length) return "";
  const next = (cur) => {
    const idx = slotList.findIndex((s) => s.slot === cur);
    return slotList[(idx + 1) % slotList.length].slot;
  };
  const days = schedule
    .filter((s) => (s.away === team || s.home === team) && s.ymd >= g && s.ymd <= t)
    .sort((a, b) => a.ymd.localeCompare(b.ymd));
  let cur = slotList[0].slot;
  for (const gm of days) {
    const off = officials.find(
      (o) => o.gameId === gm.gameId && o.team === team && o.firstSeen && o.firstSeen < `${g}0900`,
    );
    let predicted;
    if (off) {
      predicted = off.starter;
      const offSlot = slotList.find((s) => s.pitcher === off.starter)?.slot;
      cur = offSlot != null ? next(offSlot) : cur;
    } else {
      predicted = slotList.find((s) => s.slot === cur)?.pitcher ?? "";
      cur = next(cur);
    }
    if (gm.ymd === t) return predicted;
  }
  return "";
}

// --- 슬롯 모델(실운영 기록) — git 스냅샷 ------------------------------------
function gitPredictedAsOf(g) {
  const iso = `${g.slice(0, 4)}-${g.slice(4, 6)}-${g.slice(6, 8)}T09:05:00+09:00`;
  let commit = "";
  try {
    commit = execSync(`git rev-list -1 --before="${iso}" HEAD -- ${DATA_DIR}/starters/predicted`, { encoding: "utf8" }).trim();
  } catch { return new Map(); }
  if (!commit) return new Map();
  const map = new Map();
  for (const month of monthsCovering(g, ymdOffset(g, 3))) {
    let content = "";
    try {
      content = execSync(`git show ${commit}:${DATA_DIR}/starters/predicted/${month}.md`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    } catch { continue; }
    for (const r of parseTableRows(content, "예상 선발")) map.set(`${r[1]}|${r[2]}`, r[3]);
  }
  return map;
}

// --- 평가 -------------------------------------------------------------------
const stats = { slot: {}, derived: {} };
for (const L of LEADS) { stats.slot[L] = { match: 0, total: 0, none: 0 }; stats.derived[L] = { match: 0, total: 0, none: 0 }; }
const detail = [];

for (const g of ymdRange(START, END)) {
  const { rotation } = await deriveRotation(g, {
    horizon: 3,
    actualThrough: ymdOffset(g, -1), // g 아침에는 g일 경기가 아직 안 열렸다
    knownBy: `${g}0900`,
  });
  const snapshot = gitPredictedAsOf(g);
  for (const L of LEADS) {
    const t = ymdOffset(g, L);
    for (const gm of schedule.filter((s) => s.ymd === t)) {
      if (canceled.has(gm.gameId)) continue;
      for (const team of [gm.away, gm.home]) {
        const truth = actualByGameTeam.get(`${gm.gameId}|${team}`);
        if (!truth) continue; // 실제 미기록(미래 or 데이터 없음) 제외
        const slotPred = snapshot.get(`${gm.gameId}|${team}`) ?? "";
        const derivedPred = simulatePrediction(rotation, g, t, team);
        for (const [model, pred] of [["slot", slotPred], ["derived", derivedPred]]) {
          stats[model][L].total += 1;
          if (!pred) stats[model][L].none += 1;
          else if (pred === truth) stats[model][L].match += 1;
        }
        detail.push({ g, L, t, team, truth, slotPred, derivedPred });
      }
    }
  }
}

// --- 출력 -------------------------------------------------------------------
const pct = (m, t) => (t ? `${((100 * m) / t).toFixed(1)}%` : "-");
console.log(`# 백테스트: 슬롯 모델 vs 관측 파생 모델 (${START}~${END}, 생성 09:00 KST 기준)`);
console.log("");
console.log("| lead | 슬롯(실운영) 적중 | 파생 모델 적중 | 표본 | 슬롯 무예측 | 파생 무예측 |");
console.log("|---|---|---|---|---|---|");
for (const L of LEADS) {
  const s = stats.slot[L]; const r = stats.derived[L];
  console.log(`| D+${L} | ${s.match}/${s.total} (${pct(s.match, s.total)}) | ${r.match}/${r.total} (${pct(r.match, r.total)}) | ${s.total} | ${s.none} | ${r.none} |`);
}
console.log("");
// 일자별 요약 (D+1만, 재개 구간 확인용)
console.log("## D+1 일자별 (t 기준)");
console.log("");
console.log("| t | 슬롯 | 파생 | 표본 |");
console.log("|---|---|---|---|");
const byT = new Map();
for (const d of detail.filter((x) => x.L === 1)) {
  if (!byT.has(d.t)) byT.set(d.t, { s: 0, r: 0, n: 0 });
  const b = byT.get(d.t);
  b.n += 1;
  if (d.slotPred === d.truth) b.s += 1;
  if (d.derivedPred === d.truth) b.r += 1;
}
for (const [t, b] of [...byT].sort()) console.log(`| ${t} | ${b.s}/${b.n} | ${b.r}/${b.n} | ${b.n} |`);
