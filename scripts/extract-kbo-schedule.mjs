// 월별 KBO 일정+상태 수집 → docs/data/schedule/YYYY-MM.md
// 소스: Schedule.aspx (기존 셀렉터 유지)
// 한계: 진행 중인 당일 경기는 상태 "미정"/gameId 빈값 → GameCenter 날짜 페이지(preview/review)로 보완.
import {
  DATA_DIR,
  USER_AGENT,
  kstToday,
  kstStamp,
  withBrowser,
  writeFileEnsured,
} from "./lib/kbo.mjs";

const today = kstToday();
const year = process.argv[2] ?? today.slice(0, 4);
const month = process.argv[3] ?? today.slice(4, 6);

if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month)) {
  console.error("Usage: node scripts/extract-kbo-schedule.mjs [YYYY] [MM]");
  process.exit(1);
}

const OUTPUT_PATH = `${DATA_DIR}/schedule/${year}-${month}.md`;

function normalizeStatus(gameCenterText, noteText) {
  if (noteText && noteText !== "-") return noteText;
  if (gameCenterText.includes("프리뷰")) return "예정";
  if (gameCenterText.includes("리뷰")) return "종료";
  return gameCenterText || "미정";
}

function toMarkdown(rows) {
  const lines = [
    `# ${year}년 ${Number(month)}월 KBO 일정`,
    "",
    `마지막 갱신: ${kstStamp()} · 생성 스크립트: extract-kbo-schedule.mjs`,
    "",
    "> KBO `Schedule.aspx` 공개 페이지를 Playwright로 렌더링해 리스트 테이블을 정규화한 검증용 데이터.",
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

const normalizedRows = await withBrowser(async (page) => {
  void USER_AGENT; // UA는 withBrowser 내부에서 적용됨
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForSelector("#tblScheduleList tbody tr", { timeout: 30000 });

  const rows = await page.locator("#tblScheduleList tbody tr").evaluateAll((tableRows) => {
    let currentDate = "";
    return tableRows
      .map((row) => {
        const cells = Array.from(row.children);
        const firstText = cells[0]?.innerText.trim() ?? "";
        const hasDate = /^\d{2}\.\d{2}/.test(firstText);
        const offset = hasDate ? 1 : 0;
        if (hasDate) currentDate = firstText;

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

  return rows.map((row) => ({
    dateLabel: row.dateLabel,
    time: row.time,
    awayTeam: row.awayTeam,
    homeTeam: row.homeTeam,
    stadium: row.stadium,
    status: normalizeStatus(row.gameCenterText, row.note),
    gameId: row.gameId,
  }));
});

if (normalizedRows.length === 0) {
  console.error(`No schedule rows parsed for ${year}-${month}.`);
  process.exit(1);
}

await writeFileEnsured(OUTPUT_PATH, toMarkdown(normalizedRows));
console.log(`Wrote ${normalizedRows.length} schedule rows to ${OUTPUT_PATH}.`);
