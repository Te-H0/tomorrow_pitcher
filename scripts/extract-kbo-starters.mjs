import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const TEAM_CODES = {
  LG: "LG",
  NC: "NC",
  KT: "KT",
  KIA: "HT",
  두산: "OB",
  롯데: "LT",
  삼성: "SS",
  한화: "HH",
  키움: "WO",
  SSG: "SK",
};

const month = process.argv[2];

if (!month || !month.match(/^\d{2}$/)) {
  console.error("Usage: node scripts/extract-kbo-starters.mjs <MM>");
  process.exit(1);
}

const SCHEDULE_PATH = `docs/data/2026-${month}-kbo-schedule.md`;
const OUTPUT_PATH = `docs/data/2026-${month}-kbo-starters.md`;

function dateKey(dateLabel) {
  const match = dateLabel.match(/^(\d{2})\.(\d{2})/);
  if (!match) {
    throw new Error(`Invalid date label: ${dateLabel}`);
  }

  return `2026${match[1]}${match[2]}`;
}

function gameIdFor(game) {
  const awayCode = TEAM_CODES[game.awayTeam];
  const homeCode = TEAM_CODES[game.homeTeam];

  if (!awayCode || !homeCode) {
    throw new Error(`Missing team code: ${game.awayTeam} vs ${game.homeTeam}`);
  }

  return `${dateKey(game.dateLabel)}${awayCode}${homeCode}0`;
}

function parseSchedule(markdown) {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("| ") && !line.includes("---") && !line.includes("날짜"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .map(([dateLabel, time, awayTeam, homeTeam, stadium, status]) => ({
      dateLabel,
      time,
      awayTeam,
      homeTeam,
      stadium,
      status,
    }))
    .filter((game) => game.status === "종료");
}

async function readStarter(page, tableId) {
  const row = page.locator(`#${tableId} tbody tr`, { hasText: "선발" }).first();
  await row.waitFor({ timeout: 15000 });
  return row.locator("td").first().innerText();
}

async function extractGame(page, game) {
  const gameId = gameIdFor(game);
  const gameDate = dateKey(game.dateLabel);
  const url = `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${gameDate}&gameId=${gameId}&section=REVIEW`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#tblAwayPitcher tbody tr", { timeout: 20000 });

  const awayStarter = await readStarter(page, "tblAwayPitcher");
  const homeStarter = await readStarter(page, "tblHomePitcher");

  return {
    ...game,
    awayStarter: awayStarter.trim(),
    homeStarter: homeStarter.trim(),
    gameId,
  };
}

function toMarkdown(rows, failures) {
  const lines = [
    `# 2026년 ${Number(month)}월 KBO 선발투수`,
    "",
    "> KBO GameCenter 공개 페이지를 Playwright로 렌더링한 뒤 투수 기록 테이블에서 `등판=선발` 행을 추출한 임시 분석 데이터입니다.",
    "",
    "| 날짜 | 시간 | 원정 | 원정 선발 | 홈 | 홈 선발 | 구장 | 상태 | gameId |",
    "|---|---:|---|---|---|---|---|---|---|",
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.dateLabel} | ${row.time} | ${row.awayTeam} | ${row.awayStarter} | ${row.homeTeam} | ${row.homeStarter} | ${row.stadium} | ${row.status} | ${row.gameId} |`,
    );
  }

  if (failures.length > 0) {
    lines.push("", "## 추출 실패", "");
    lines.push("| 날짜 | 시간 | 원정 | 홈 | 구장 | 예상 gameId | 사유 |");
    lines.push("|---|---:|---|---|---|---|---|");

    for (const failure of failures) {
      lines.push(
        `| ${failure.game.dateLabel} | ${failure.game.time} | ${failure.game.awayTeam} | ${failure.game.homeTeam} | ${failure.game.stadium} | ${failure.gameId ?? ""} | ${failure.reason.replaceAll("|", "/")} |`,
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

const schedule = await readFile(SCHEDULE_PATH, "utf8");
const games = parseSchedule(schedule);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
});

const rows = [];
const failures = [];

try {
  for (const game of games) {
    const gameId = gameIdFor(game);
    try {
      console.log(`Extracting ${game.dateLabel} ${game.awayTeam} vs ${game.homeTeam} (${gameId})`);
      rows.push(await extractGame(page, game));
      await page.waitForTimeout(500);
    } catch (error) {
      failures.push({
        game,
        gameId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
} finally {
  await browser.close();
}

await mkdir("docs/data", { recursive: true });
await writeFile(OUTPUT_PATH, toMarkdown(rows, failures));
console.log(`Wrote ${rows.length} starter rows to ${OUTPUT_PATH}. Failures: ${failures.length}.`);

