// GameCenter REVIEW 파싱·렌더 공용 모듈
// extract-kbo-review.mjs(날짜 기반)와 backfill-kbo-review.mjs(gameId 기반)가 공유한다.
// 두 스크립트의 산출물(starters/actual/YYYY-MM.md, games/YYYY-MM.md) 형식은 이 모듈 하나로 통일된다.
import { dateLabelFromYmd, gameCenterReviewUrl, kstStamp, parseTableRows } from "./kbo.mjs";

export const PITCHER_HEADERS = [
  "선수명", "등판", "결과", "승", "패", "세", "이닝", "타자", "투구수",
  "타수", "피안타", "홈런", "4사구", "삼진", "실점", "자책", "평균자책점",
];

// REVIEW 페이지 DOM → 스코어보드/기타기록/투수/타자 원시 셀 배열
export async function parseReview(page) {
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

// REVIEW 페이지로 이동 후 파싱까지. 두 스크립트가 동일한 대기 조건을 쓰도록 묶는다.
export async function gotoAndParseReview(page, ymd, gameId) {
  await page.goto(gameCenterReviewUrl(ymd, gameId), {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForSelector("#tblAwayPitcher tbody tr", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return parseReview(page);
}

// 투수 기록에서 등판=선발 행의 선수명
export function starterName(pitcherRows) {
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

// games/YYYY-MM.md 의 경기 1섹션.
// game: { ymd, gameId, awayName, homeName }
export function gameSection(game, review) {
  const label = dateLabelFromYmd(game.ymd);
  const heading = `## ${label} ${game.awayName} @ ${game.homeName} (${game.gameId})`;
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
    `- 결과: ${game.awayName} ${awayR} : ${homeR} ${game.homeName}`,
    `- 원정 ${game.awayName}: R${awayR} ${awayHEB} / 이닝 ${innAway}`,
    `- 홈 ${game.homeName}: R${homeR} ${homeHEB} / 이닝 ${innHome}`,
    `- 기록: ${etcLine || "-"}`,
    "",
    "### 투수 기록",
    "",
    `원정 ${game.awayName}:`,
    "",
    pitcherTable(review.awayPitchers),
    "",
    `홈 ${game.homeName}:`,
    "",
    pitcherTable(review.homePitchers),
    "",
    "### 타자 기록",
    "",
    `원정 ${game.awayName}:`,
    "",
    hitterTable(review.awayHitters),
    "",
    `홈 ${game.homeName}:`,
    "",
    hitterTable(review.homeHitters),
  ];
  return { heading, block: parts.join("\n") };
}

// starters/actual 실제 선발 행 (신형식: 날짜 | gameId | 원정 | 원정 선발 | 홈 | 홈 선발 | 구장 | 상태)
export function actualRow(game, review) {
  return [
    dateLabelFromYmd(game.ymd),
    game.gameId,
    game.awayName,
    starterName(review.awayPitchers),
    game.homeName,
    starterName(review.homePitchers),
    game.stadium ?? "",
    "end",
  ];
}

// ---------------------------------------------------------------------------
// 기존 산출물 읽기 (멱등 스킵의 근거)
//
// actual 파일에는 두 가지 형식이 섞여 있다.
//   구형식(4~6월 초): 날짜 | 시간 | 원정 | 원정 선발 | 홈 | 홈 선발 | 구장 | 상태 | gameId  (9열, gameId 마지막)
//   신형식(7월~):     날짜 | gameId | 원정 | 원정 선발 | 홈 | 홈 선발 | 구장 | 상태        (8열, gameId 2번째)
// 둘 다 읽어서 신형식으로 정규화한다. 구형식의 "시간"은 신형식에 자리가 없어 버려지고,
// 상태 "종료"는 "end"로 맞춘다(같은 의미, 신형식 표기).
// ---------------------------------------------------------------------------
function looksLikeGameId(cell) {
  return /^\d{8}[A-Z]{4}\d$/.test((cell ?? "").trim());
}

// 구형식/신형식 실제 선발 행 → 신형식 행 배열
export function normalizeActualRows(content) {
  const rows = parseTableRows(content, "원정 선발");
  return rows
    .map((r) => {
      if (looksLikeGameId(r[1])) return r; // 신형식
      if (looksLikeGameId(r[8])) {
        // 구형식 9열 → 신형식 8열 (시간 컬럼 제거, gameId 앞으로, 상태 정규화)
        return [r[0], r[8], r[2], r[3], r[4], r[5], r[6], r[7] === "종료" ? "end" : r[7]];
      }
      return null; // gameId를 못 찾은 행은 스킵 대상 판별에 쓸 수 없다
    })
    .filter(Boolean);
}

// 취소/노게임 행도 같은 방식으로 정규화 (날짜 | gameId | 원정 | 홈 | 구장 | 사유)
export function normalizeCancelRows(content) {
  return parseTableRows(content, "사유").filter((r) => looksLikeGameId(r[1]));
}

// actual 본문 + games 섹션 헤딩에서 이미 기록된 gameId 집합을 만든다.
export function recordedIds(existingActual, existingGames) {
  const end = new Set([
    ...normalizeActualRows(existingActual).map((r) => r[1]),
    ...(existingGames.match(/^##\s+.*\(([^)]+)\)\s*$/gm) ?? [])
      .map((line) => line.match(/\(([^)]+)\)\s*$/)?.[1])
      .filter(Boolean),
  ]);
  const cancel = new Set(normalizeCancelRows(existingActual).map((r) => r[1]));
  return { end, cancel };
}

// ---------------------------------------------------------------------------
// 렌더
// ---------------------------------------------------------------------------
export function renderActual(month, actualRows, cancelRows, script) {
  const lines = [
    `# ${month} KBO 실제 선발`,
    "",
    `마지막 갱신: ${kstStamp()} · 생성 스크립트: ${script}`,
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

export function emptyGamesFile(month, script) {
  return [
    `# ${month} KBO 경기 결과 상세`,
    "",
    `마지막 갱신: ${kstStamp()} · 생성 스크립트: ${script}`,
    "",
    "> GameCenter REVIEW 스코어보드/투수 전원/타자 기록. 경기당 1섹션.",
    "",
  ].join("\n");
}

// gameId 오름차순 = 날짜 오름차순(YYYYMMDD 접두) 이므로 정렬 키로 그대로 쓴다.
export function byGameId(a, b) {
  return a[1].localeCompare(b[1]);
}
