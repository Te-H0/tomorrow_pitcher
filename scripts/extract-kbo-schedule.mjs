import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const year = process.argv[2];
const month = process.argv[3];

if (!year?.match(/^\d{4}$/) || !month?.match(/^\d{2}$/)) {
  console.error("Usage: node scripts/extract-kbo-schedule.mjs <YYYY> <MM>");
  process.exit(1);
}

const OUTPUT_PATH = `docs/data/${year}-${month}-kbo-schedule.md`;

function normalizeStatus(gameCenterText, noteText) {
  if (noteText && noteText !== "-") {
    return noteText;
  }

  if (gameCenterText.includes("프리뷰")) {
    return "예정";
  }

  if (gameCenterText.includes("리뷰")) {
    return "종료";
  }

  return gameCenterText || "미정";
}

function toMarkdown(rows) {
  const lines = [
    `# ${year}년 ${Number(month)}월 KBO 일정`,
    "",
    "> KBO `Schedule.aspx` 공개 페이지를 Playwright로 렌더링한 뒤 리스트 테이블을 정규화한 임시 분석 데이터입니다.",
    "",
    "| 날짜 | 시간 | 원정 | 홈 | 구장 | 상태 | gameId |",
    "|---|---:|---|---|---|---|---|",
  ];

  for (const row of rows) {
    lines.push(
      `| ${row.dateLabel} | ${row.time} | ${row.awayTeam} | ${row.homeTeam} | ${row.stadium} | ${row.status} | ${row.gameId} |`,
    );
  }

  return `${lines.join("\n")}\n`;
}

const url = `https://www.koreabaseball.com/Schedule/Schedule.aspx?seriesId=0,9&year=${year}&month=${month}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector("#tblScheduleList tbody tr", { timeout: 20000 });

  const rows = await page.locator("#tblScheduleList tbody tr").evaluateAll((tableRows) => {
    let currentDate = "";

    return tableRows
      .map((row) => {
        const cells = Array.from(row.children);
        const firstText = cells[0]?.innerText.trim() ?? "";
        const hasDate = /^\d{2}\.\d{2}/.test(firstText);
        const offset = hasDate ? 1 : 0;

        if (hasDate) {
          currentDate = firstText;
        }

        const gameCell = cells[offset + 1];
        const teams = Array.from(gameCell?.querySelectorAll(":scope > span") ?? []).map((span) =>
          span.innerText.trim(),
        );
        const gameCenterCell = cells[offset + 2];
        const gameCenterLink = gameCenterCell?.querySelector("a");
        const gameId = new URL(
          gameCenterLink?.getAttribute("href") ?? "",
          "https://www.koreabaseball.com",
        ).searchParams.get("gameId");

        return {
          dateLabel: currentDate,
          time: cells[offset]?.innerText.trim() ?? "",
          awayTeam: teams[0] ?? "",
          homeTeam: teams[1] ?? "",
          gameCenterText: gameCenterCell?.innerText.trim() ?? "",
          stadium: cells[offset + 6]?.innerText.trim() ?? "",
          note: cells[offset + 7]?.innerText.trim() ?? "",
          gameId: gameId ?? "",
        };
      })
      .filter((row) => row.dateLabel && row.time && row.awayTeam && row.homeTeam);
  });

  const normalizedRows = rows.map((row) => ({
    dateLabel: row.dateLabel,
    time: row.time,
    awayTeam: row.awayTeam,
    homeTeam: row.homeTeam,
    stadium: row.stadium,
    status: normalizeStatus(row.gameCenterText, row.note),
    gameId: row.gameId,
  }));

  await mkdir("docs/data", { recursive: true });
  await writeFile(OUTPUT_PATH, toMarkdown(normalizedRows));
  console.log(`Wrote ${normalizedRows.length} schedule rows to ${OUTPUT_PATH}.`);
} finally {
  await browser.close();
}
