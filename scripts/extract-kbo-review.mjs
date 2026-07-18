// 종료 경기 실제 선발 + 경기 결과 상세 수집
//  → docs/data/starters/actual/YYYY-MM.md (실제 선발, end 경기만)
//  → docs/data/games/YYYY-MM.md (스코어보드+투수 전원+타자 기록)
// 소스: GameCenter 날짜 페이지 → end 경기만 REVIEW. cancel 경기는 ACTUAL 미생성(취소/노게임 기록).
// 인자 생략 시 오늘(KST).
import {
  DATA_DIR,
  dateLabelFromYmd,
  gameCenterDateUrl,
  gameCenterReviewUrl,
  gameState,
  kstStamp,
  kstToday,
  monthOf,
  parseTableRows,
  readFileOrEmpty,
  readGameConts,
  replaceSection,
  sleep,
  upsertRows,
  withBrowser,
  writeFileEnsured,
} from "./lib/kbo.mjs";

const PITCHER_HEADERS = [
  "선수명", "등판", "결과", "승", "패", "세", "이닝", "타자", "투구수",
  "타수", "피안타", "홈런", "4사구", "삼진", "실점", "자책", "평균자책점",
];

const ymd = process.argv[2] ?? kstToday();
if (!/^\d{8}$/.test(ymd)) {
  console.error("Usage: node scripts/extract-kbo-review.mjs [YYYYMMDD]");
  process.exit(1);
}
const month = monthOf(ymd);

async function parseReview(page) {
  return page.evaluate(() => {
    const clean = (s) => (s || "").trim().replace(/\s+/g, " ");
    const rowsOf = (id, sel) => {
      const t = document.getElementById(id);
      if (!t) return [];
      return Array.from(t.querySelectorAll("tbody tr")).map((tr) =>
        Array.from(tr.querySelectorAll(sel)).map((c) => clean(c.innerText)),
      );
    };
    const board = (id) => rowsOf(id, "th,td");
    const b2 = board("tblScordboard2");
    const b3 = board("tblScordboard3");
    const etc = board("tblEtc").map((r) => [r[0] || "", r.slice(1).join(" ").trim()]);
    const pitchers = (id) => rowsOf(id, "td");
    const hitters = (id1, id3) => {
      const t3 = document.getElementById(id3);
      const r1 = rowsOf(id1, "th,td");
      const r3 = t3
        ? Array.from(t3.querySelectorAll("tbody tr")).map((tr) =>
            Array.from(tr.querySelectorAll("th,td")).map((c) => clean(c.innerText)),
          )
        : [];
      return r1.map((cells, i) => ({
        order: cells[0] || "",
        name: cells[cells.length - 1] || "",
        stats: r3[i] || [],
      }));
    };
    return {
      board2: { away: b2[0] || [], home: b2[1] || [] },
      board3: { away: b3[0] || [], home: b3[1] || [] },
      etc,
      awayPitchers: pitchers("tblAwayPitcher"),
      homePitchers: pitchers("tblHomePitcher"),
      awayHitters: hitters("tblAwayHitter1", "tblAwayHitter3"),
      homeHitters: hitters("tblHomeHitter1", "tblHomeHitter3"),
    };
  });
}

function starterName(pitcherRows) {
  const row = pitcherRows.find((r) => r[1] === "선발") ?? pitcherRows[0];
  return row?.[0] ?? "";
}

function pitcherTable(rows) {
  const lines = [`| ${PITCHER_HEADERS.join(" | ")} |`, `|${PITCHER_HEADERS.map(() => "---").join("|")}|`];
  for (const r of rows) lines.push(`| ${r.join(" | ")} |`);
  return lines.join("\n");
}

function hitterTable(hitters) {
  const lines = ["| 타순 | 선수명 | 타수 | 안타 | 타점 | 득점 | 타율 |", "|---|---|---|---|---|---|---|"];
  for (const h of hitters) {
    lines.push(`| ${h.order} | ${h.name} | ${(h.stats[0] ?? "")} | ${(h.stats[1] ?? "")} | ${(h.stats[2] ?? "")} | ${(h.stats[3] ?? "")} | ${(h.stats[4] ?? "")} |`);
  }
  return lines.join("\n");
}

function gameSection(g, review) {
  const label = dateLabelFromYmd(g.attrs.g_dt);
  const heading = `## ${label} ${g.attrs.away_nm} @ ${g.attrs.home_nm} (${g.attrs.g_id})`;
  const awayR = review.board3.away[0] ?? "";
  const homeR = review.board3.home[0] ?? "";
  const awayHEB = `H${review.board3.away[1] ?? ""} E${review.board3.away[2] ?? ""} B${review.board3.away[3] ?? ""}`;
  const homeHEB = `H${review.board3.home[1] ?? ""} E${review.board3.home[2] ?? ""} B${review.board3.home[3] ?? ""}`;
  const innAway = review.board2.away.join(" ");
  const innHome = review.board2.home.join(" ");
  const etcLine = review.etc.map(([k, v]) => `${k} ${v}`.trim()).filter(Boolean).join(" · ");

  const parts = [
    heading,
    "",
    `- 결과: ${g.attrs.away_nm} ${awayR} : ${homeR} ${g.attrs.home_nm}`,
    `- 원정 ${g.attrs.away_nm}: R${awayR} ${awayHEB} / 이닝 ${innAway}`,
    `- 홈 ${g.attrs.home_nm}: R${homeR} ${homeHEB} / 이닝 ${innHome}`,
    `- 기록: ${etcLine || "-"}`,
    "",
    "### 투수 기록",
    "",
    `원정 ${g.attrs.away_nm}:`,
    "",
    pitcherTable(review.awayPitchers),
    "",
    `홈 ${g.attrs.home_nm}:`,
    "",
    pitcherTable(review.homePitchers),
    "",
    "### 타자 기록",
    "",
    `원정 ${g.attrs.away_nm}:`,
    "",
    hitterTable(review.awayHitters),
    "",
    `홈 ${g.attrs.home_nm}:`,
    "",
    hitterTable(review.homeHitters),
  ];
  return { heading, block: parts.join("\n") };
}

function renderActual(actualRows, cancelRows) {
  const lines = [
    `# ${month} KBO 실제 선발`,
    "",
    `마지막 갱신: ${kstStamp()} · 생성 스크립트: extract-kbo-review.mjs`,
    "",
    "> GameCenter REVIEW 투수 기록에서 `등판=선발` 행으로 확정한 실제 선발. 신뢰순위 ACTUAL(최상위). 취소/노게임은 ACTUAL 미생성.",
    "",
    "| 날짜 | gameId | 원정 | 원정 선발 | 홈 | 홈 선발 | 구장 | 상태 |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const r of actualRows) lines.push(`| ${r.join(" | ")} |`);
  lines.push("", "## 취소/노게임", "");
  lines.push("| 날짜 | gameId | 원정 | 홈 | 구장 | 사유 |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of cancelRows) lines.push(`| ${r.join(" | ")} |`);
  return `${lines.join("\n")}\n`;
}

function emptyGamesFile() {
  return [
    `# ${month} KBO 경기 결과 상세`,
    "",
    `마지막 갱신: ${kstStamp()} · 생성 스크립트: extract-kbo-review.mjs`,
    "",
    "> GameCenter REVIEW 스코어보드/투수 전원/타자 기록. 경기당 1섹션.",
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
const result = await withBrowser(async (page) => {
  await page.goto(gameCenterDateUrl(ymd), { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);
  // GameCenter 날짜 페이지는 서비스 윈도우 밖의 과거 날짜를 가장 가까운 유효일로 clamp한다.
  // 요청 날짜와 g_dt가 다른 경우(=clamp)는 해당 날짜 데이터가 아니므로 버린다.
  const games = (await readGameConts(page)).filter((g) => g.attrs.g_dt === ymd);

  const actualRows = [];
  const cancelRows = [];
  const gameSections = [];
  let endCount = 0;

  for (const g of games) {
    const state = gameState(g.cls);
    if (state === "cancel") {
      cancelRows.push([
        dateLabelFromYmd(g.attrs.g_dt),
        g.attrs.g_id,
        g.attrs.away_nm,
        g.attrs.home_nm,
        g.attrs.s_nm,
        "경기 취소",
      ]);
      continue;
    }
    if (state !== "end") continue; // 예정/진행 중은 아직 ACTUAL 없음
    endCount += 1;

    await page.goto(gameCenterReviewUrl(g.attrs.g_dt, g.attrs.g_id), {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForSelector("#tblAwayPitcher tbody tr", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const review = await parseReview(page);

    actualRows.push([
      dateLabelFromYmd(g.attrs.g_dt),
      g.attrs.g_id,
      g.attrs.away_nm,
      starterName(review.awayPitchers),
      g.attrs.home_nm,
      starterName(review.homePitchers),
      g.attrs.s_nm,
      "end",
    ]);
    gameSections.push(gameSection(g, review));
    await sleep(500);
  }

  return { gamesTotal: games.length, endCount, actualRows, cancelRows, gameSections };
});

if (result.gamesTotal === 0) {
  console.log(`No games scheduled on ${ymd}. (해당 날짜 경기 없음) — 정상 종료.`);
  process.exit(0);
}
if (result.endCount > 0 && result.actualRows.length === 0) {
  console.error(`Found ${result.endCount} finished games but parsed 0 actual starters — DOM 계약 의심.`);
  process.exit(1);
}

// actual/YYYY-MM.md upsert (end 행 + 취소 행)
const actualPath = `${DATA_DIR}/starters/actual/${month}.md`;
const existing = await readFileOrEmpty(actualPath);
const mergedActual = upsertRows(
  parseTableRows(existing, "원정 선발"),
  result.actualRows,
  (r) => r[1],
  (a, b) => a[1].localeCompare(b[1]),
);
const mergedCancel = upsertRows(
  parseTableRows(existing, "사유"),
  result.cancelRows,
  (r) => r[1],
  (a, b) => a[1].localeCompare(b[1]),
);
await writeFileEnsured(actualPath, renderActual(mergedActual, mergedCancel));

// games/YYYY-MM.md 섹션 교체
const gamesPath = `${DATA_DIR}/games/${month}.md`;
let gamesContent = (await readFileOrEmpty(gamesPath)) || emptyGamesFile();
// 최신 갱신 시각 라인 교체
gamesContent = gamesContent.replace(/^마지막 갱신:.*$/m, `마지막 갱신: ${kstStamp()} · 생성 스크립트: extract-kbo-review.mjs`);
for (const s of result.gameSections) {
  gamesContent = replaceSection(gamesContent, s.heading, s.block);
}
await writeFileEnsured(gamesPath, gamesContent);

console.log(
  `${ymd}: total ${result.gamesTotal} games, end ${result.endCount}, actual ${result.actualRows.length}, cancel ${result.cancelRows.length}. Wrote ${actualPath} + ${gamesPath}.`,
);
