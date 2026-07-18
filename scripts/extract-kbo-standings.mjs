// 팀 순위 스냅샷 → docs/data/standings/YYYY-MM.md (당일 섹션 교체)
// 소스: TeamRankDaily.aspx (table.tData 1=순위표, 2=팀간 승패표)
import {
  DATA_DIR,
  isoDate,
  kstStamp,
  kstToday,
  monthOf,
  readFileOrEmpty,
  replaceSection,
  withBrowser,
  writeFileEnsured,
} from "./lib/kbo.mjs";

const ymd = kstToday();
const month = monthOf(ymd);
const dateIso = isoDate(ymd);

const data = await withBrowser(async (page) => {
  await page.goto("https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForSelector("table.tData tbody tr", { timeout: 30000 });
  return page.evaluate(() => {
    const clean = (s) => (s || "").trim().replace(/\s+/g, " ");
    const parse = (t) => {
      if (!t) return { headers: [], rows: [] };
      const headers = Array.from(t.querySelectorAll("thead th")).map((th) => clean(th.innerText));
      const rows = Array.from(t.querySelectorAll("tbody tr")).map((tr) =>
        Array.from(tr.querySelectorAll("th,td")).map((td) => clean(td.innerText)),
      );
      return { headers, rows };
    };
    const tables = document.querySelectorAll("table.tData");
    return { rank: parse(tables[0]), matrix: parse(tables[1]) };
  });
});

if (!data.rank.rows.length) {
  console.error("No standings rows parsed — DOM 계약 의심.");
  process.exit(1);
}

function table(headers, rows) {
  const lines = [`| ${headers.join(" | ")} |`, `|${headers.map(() => "---").join("|")}|`];
  for (const r of rows) lines.push(`| ${r.join(" | ")} |`);
  return lines.join("\n");
}

const block = [
  `## ${dateIso}`,
  "",
  `갱신: ${kstStamp()} · extract-kbo-standings.mjs`,
  "",
  table(data.rank.headers, data.rank.rows),
  "",
  "### 팀간 승패표",
  "",
  table(data.matrix.headers, data.matrix.rows),
].join("\n");

const path = `${DATA_DIR}/standings/${month}.md`;
let content = await readFileOrEmpty(path);
if (!content) {
  content = `# ${month} KBO 순위 스냅샷\n\n> TeamRankDaily.aspx 일자별 순위/상대전적. 날짜당 1섹션.\n`;
}
content = replaceSection(content, `## ${dateIso}`, block);
await writeFileEnsured(path, content);
console.log(`Wrote standings ${dateIso} (${data.rank.rows.length} teams) to ${path}.`);
