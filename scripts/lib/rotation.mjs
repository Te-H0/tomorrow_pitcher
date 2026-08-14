// 로테이션 자동 파생: 관측(실제 선발 + 예고 + 등록/말소)에서 팀별 선발 순서를 매번 유도한다.
//
// 배경(2026-08-14 결정): 수동 관리 slots.md는 재개/재편 시점마다 낡아 예측이 붕괴했다.
// 백테스트(7/18~8/13, lead별 — docs/progress/2026-08-14-restday-backtest.md) 결과
// 관측 파생 모델이 슬롯 모델을 전 구간에서 이겨 "순서를 저장하지 말고 관측에서 유도"로 전환했다.
//
// 파생 규칙:
// - 후보 풀: 최근 POOL_WINDOW_DAYS 내 실제 선발 등판자 + 예고에 뜬 투수(신규 편입 즉시 반영).
// - 순서: 마지막 등판일 오름차순(가장 오래 쉰 투수 = 슬롯 1 = 다음 차례). 휴식일 기반 파생 순서.
// - 제외: 마지막 등판이 MAX_REST_DAYS보다 오래된 투수(이탈 추정, 단 최근 예고에 뜨면 유지),
//         말소 후 재등록·재예고 없는 투수(10일 규정), overrides의 "제외" 행.
// - TEMPORARY: 윈도 내 등판 1회 이하(스팟/신규 미검증). 예측에는 포함하되 표기.
// - 사람 보정은 rotation/overrides.md 단일 진입점(제외/포함)으로만 한다.
//
// 백테스트 재현용 옵션(as-of):
// - actualThrough: 이 날짜까지의 실제 선발만 사용(기본 asOf 당일 포함 — 저녁 회차에서
//   오늘 등판자를 즉시 반영해 "방금 던진 투수"가 다음 차례로 남지 않게 한다).
// - knownBy: "YYYYMMDDHHmm" — 최초수집이 이 시각 이전인 예고만 사용(과거 시점 재현).
import { DATA_DIR, TEAM_NAME_BY_CODE, daysBetween, monthOf, monthsCovering, parseTableRows, readFileOrEmpty, ymdFromDateCell, ymdOffset } from "./kbo.mjs";

export const POOL_WINDOW_DAYS = 20; // 후보 풀 관측 윈도
export const MAX_REST_DAYS = 14;    // 이보다 오래 쉬면 이탈로 간주(연속 취소 감안해 넉넉히)

const CANONICAL_TEAMS = new Set(Object.values(TEAM_NAME_BY_CODE));

// "2026-07-31 23:22 KST" → "202607312322" (비면 "")
function stampToSortable(kstStamp) {
  const m = (kstStamp ?? "").match(/^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/);
  return m ? `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}` : "";
}

// availability/YYYY-MM.md 파싱 → [{date(YMD), team, type: "등록"|"말소", player}]
export function parseAvailability(content, month) {
  const events = [];
  let date = "";
  let team = "";
  let type = "";
  for (const line of content.split("\n")) {
    const d = line.match(/^## (\d{4})-(\d\d)-(\d\d)/);
    if (d) { date = `${d[1]}${d[2]}${d[3]}`; continue; }
    const t = line.match(/^### (.+)/);
    if (t) { team = t[1].trim(); continue; }
    if (line.startsWith("**등록**")) { type = "등록"; continue; }
    if (line.startsWith("**말소**")) { type = "말소"; continue; }
    const c = line.match(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|/);
    if (c && date && team && type && monthOf(date) === month) {
      events.push({ date, team, type, player: c[1] });
    }
  }
  return events;
}

// rotation/overrides.md 파싱 → [{team, pitcher, action: "제외"|"포함", baseYmd, memo}]
// 잘못된 행(팀명 오타·처리 오타·기준일 형식 오류)은 조용히 넘어가지 않고 경고한다 —
// 사람 보정이 무동작으로 사라지면 운영자는 반영됐다고 믿게 되기 때문.
export function parseOverrides(content) {
  const out = [];
  for (const r of parseTableRows(content, "처리")) {
    if (!r[0] || !r[1]) continue;
    if (r[2] !== "제외" && r[2] !== "포함") {
      console.warn(`overrides 경고: 처리 값 "${r[2]}"는 제외/포함만 허용 — 행 무시 (${r[0]} ${r[1]})`);
      continue;
    }
    if (!CANONICAL_TEAMS.has(r[0])) {
      console.warn(`overrides 경고: 팀명 "${r[0]}"이 표준 표기(${[...CANONICAL_TEAMS].join("/")})와 다름 — 행 무시`);
      continue;
    }
    let baseYmd = (r[3] || "").replaceAll("-", "").replaceAll(".", "");
    if (baseYmd && !/^\d{8}$/.test(baseYmd)) {
      console.warn(`overrides 경고: 기준일 "${r[3]}"은 YYYYMMDD 형식이 아님 — 기준일 무시 (${r[0]} ${r[1]})`);
      baseYmd = "";
    }
    out.push({ team: r[0], pitcher: r[1], action: r[2], baseYmd, memo: r[4] || "" });
  }
  return out;
}

// asOf(YMD) 기준 팀별 로테이션 파생.
// 반환: { rotation: Map<team, [{slot, pitcher, status, lastStart, appearances, memo}]>, exclusions }
export async function deriveRotation(asOf, { horizon = 3, actualThrough = asOf, knownBy = "" } = {}) {
  const windowStart = ymdOffset(asOf, -POOL_WINDOW_DAYS);
  const months = monthsCovering(ymdOffset(asOf, -POOL_WINDOW_DAYS - 5), ymdOffset(asOf, horizon));

  // 관측 로드
  const actuals = []; // {ymd, team, pitcher}
  const announced = []; // {ymd, team, pitcher, firstSeen} — 예고(미래 포함)
  const avail = []; // 등록/말소 이벤트
  for (const month of months) {
    const act = await readFileOrEmpty(`${DATA_DIR}/starters/actual/${month}.md`);
    for (const r of parseTableRows(act, "원정 선발")) {
      const ymd = ymdFromDateCell(r[0], month);
      if (!ymd) continue;
      if (r[3]) actuals.push({ ymd, team: r[2], pitcher: r[3] });
      if (r[5]) actuals.push({ ymd, team: r[4], pitcher: r[5] });
    }
    const off = await readFileOrEmpty(`${DATA_DIR}/starters/official/${month}.md`);
    for (const r of parseTableRows(off, "원정 예고선발")) {
      const ymd = ymdFromDateCell(r[0], month);
      if (!ymd) continue;
      const firstSeen = stampToSortable(r[8]);
      // knownBy 재현 모드: 최초수집이 기준 시각 이후(또는 미기록)인 예고는 그 시점에 몰랐다.
      if (knownBy && (!firstSeen || firstSeen >= knownBy)) continue;
      if (r[3]) announced.push({ ymd, team: r[2], pitcher: r[3], firstSeen });
      if (r[6]) announced.push({ ymd, team: r[5], pitcher: r[6], firstSeen });
    }
    const av = await readFileOrEmpty(`${DATA_DIR}/availability/${month}.md`);
    avail.push(...parseAvailability(av, month));
  }
  const overrides = parseOverrides(await readFileOrEmpty(`${DATA_DIR}/rotation/overrides.md`));

  // 팀별 풀 구성: pitcher → {lastStart, appearances, announcedOnly}
  const byTeam = new Map();
  const ensure = (team) => {
    if (!byTeam.has(team)) byTeam.set(team, new Map());
    return byTeam.get(team);
  };
  for (const a of actuals) {
    if (a.ymd < windowStart || a.ymd > actualThrough) continue;
    const pool = ensure(a.team);
    const cur = pool.get(a.pitcher) ?? { lastStart: "", appearances: 0, announcedOnly: false };
    cur.appearances += 1;
    if (a.ymd > cur.lastStart) cur.lastStart = a.ymd;
    pool.set(a.pitcher, cur);
  }
  // 예고 투수 편입: 등판 이력이 없으면 신규(예: 외국인 교체·콜업) — 예고 경기일-5일을 의사 등판일로.
  for (const o of announced) {
    if (o.ymd < windowStart || o.ymd > ymdOffset(asOf, horizon)) continue;
    const pool = ensure(o.team);
    if (!pool.has(o.pitcher)) {
      pool.set(o.pitcher, { lastStart: ymdOffset(o.ymd, -5), appearances: 0, announcedOnly: true });
    }
  }

  // 말소 제외: 마지막 등판 이후 말소됐고 그 뒤 등록·예고가 없으면 제외.
  // 말소 이후 날짜의 예고에 떴다면 재등록된 것(availability 수집이 놓쳐도 예고가 증거) → 유지.
  const exclusionMemo = new Map(); // `${team}|${pitcher}` → memo
  for (const [team, pool] of byTeam) {
    for (const [pitcher, info] of pool) {
      const events = avail
        .filter((e) => e.team === team && e.player === pitcher && e.date <= asOf)
        .sort((a, b) => a.date.localeCompare(b.date));
      const last = events[events.length - 1];
      if (!last || last.type !== "말소" || last.date < info.lastStart) continue;
      const reAnnounced = announced.some((o) => o.team === team && o.pitcher === pitcher && o.ymd >= last.date);
      if (reAnnounced) continue;
      pool.delete(pitcher);
      exclusionMemo.set(`${team}|${pitcher}`, `${last.date.slice(4, 6)}.${last.date.slice(6, 8)} 말소`);
    }
  }

  // overrides 적용
  for (const ov of overrides) {
    const pool = ensure(ov.team);
    if (ov.action === "제외") {
      if (pool.delete(ov.pitcher)) {
        exclusionMemo.set(`${ov.team}|${ov.pitcher}`, `override 제외: ${ov.memo}`);
      } else {
        console.warn(`overrides 경고: 제외 대상 "${ov.team} ${ov.pitcher}"가 파생 풀에 없음(이미 제외됐거나 이름 오타) — 무동작`);
      }
    } else {
      // 포함은 upsert: 풀에 이미 있어도 기준일과 override 플래그를 덮어써
      // 장기 미등판 필터에 걸릴 투수를 구제할 수 있어야 한다.
      const lastStart = ov.baseYmd || ymdOffset(asOf, -5);
      const cur = pool.get(ov.pitcher);
      if (cur) {
        cur.lastStart = lastStart;
        cur.override = true;
      } else {
        pool.set(ov.pitcher, { lastStart, appearances: 0, announcedOnly: false, override: true });
      }
    }
  }

  // 최근 예고에 뜬 투수는 장기 미등판이어도 유지(예고 = 로테이션 잔류의 최상위 증거)
  const announcedRecent = new Set(
    announced
      .filter((o) => o.ymd >= ymdOffset(asOf, -2) && o.ymd <= ymdOffset(asOf, horizon))
      .map((o) => `${o.team}|${o.pitcher}`),
  );

  // 장기 미등판 제외 + 정렬(마지막 등판 오름차순 = 오래 쉰 순) + 슬롯 부여
  // 예고로만 편입된 투수도 예고가 낡으면(announcedRecent 이탈) 동일하게 이탈 처리한다 —
  // 취소로 무산된 옛 예고가 슬롯 1을 장기 점유하는 것을 막는다.
  const result = new Map();
  for (const [team, pool] of byTeam) {
    const list = [];
    for (const [pitcher, info] of pool) {
      const rest = daysBetween(info.lastStart, asOf);
      if (rest > MAX_REST_DAYS && !info.override && !announcedRecent.has(`${team}|${pitcher}`)) continue; // 이탈 추정
      const status = info.appearances >= 2 ? "ACTIVE" : "TEMPORARY";
      const memoBits = [];
      if (info.announcedOnly) memoBits.push("예고로 편입(등판 이력 없음)");
      if (info.override) memoBits.push("override 포함");
      if (info.appearances === 1) memoBits.push("윈도 내 1회 등판");
      list.push({ pitcher, status, lastStart: info.lastStart, appearances: info.appearances, memo: memoBits.join(", ") });
    }
    list.sort((a, b) => a.lastStart.localeCompare(b.lastStart) || a.pitcher.localeCompare(b.pitcher));
    result.set(team, list.map((e, i) => ({ slot: i + 1, ...e })));
  }
  return { rotation: result, exclusions: exclusionMemo };
}
