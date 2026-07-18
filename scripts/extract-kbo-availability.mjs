// 당일 1군 등록/말소 → docs/data/availability/YYYY-MM.md (당일 섹션 교체)
// 소스: Register.aspx, 팀 10곳 fnSearchChange 순회. 하단 tNData 마지막 2개 = 등록/말소.
import {
  DATA_DIR,
  REGISTER_TEAM_CODES,
  TEAM_NAME_BY_CODE,
  isoDate,
  kstStamp,
  kstToday,
  monthOf,
  readFileOrEmpty,
  replaceSection,
  sleep,
  withBrowser,
  writeFileEnsured,
} from "./lib/kbo.mjs";

const ymd = kstToday();
const month = monthOf(ymd);
const dateIso = isoDate(ymd);

async function readTeam(page, code) {
  // 팀 탭 앵커(href="javascript:fnSearchChange('CODE')")를 클릭하면 페이지 컨텍스트에서
  // __doPostBack(ASP.NET 리로드)이 정상 실행된다. (evaluate 직접 호출은 strict-mode 에러로 실패)
  const sel = `a[href*="fnSearchChange('${code}')"]`;
  await Promise.all([
    page.waitForLoadState("networkidle", { timeout: 25000 }).catch(() => {}),
    page.click(sel, { timeout: 15000 }),
  ]);
  await page.waitForSelector("table.tNData", { timeout: 30000 });
  await page.waitForTimeout(800);
  return page.evaluate(() => {
    const clean = (s) => (s || "").trim().replace(/\s+/g, " ");
    const tables = Array.from(document.querySelectorAll("table.tNData"));
    const last2 = tables.slice(-2);
    const parseMoves = (t) => {
      if (!t) return [];
      const bodyText = t.querySelector("tbody")?.innerText || "";
      if (/없습니다/.test(bodyText)) return [];
      return Array.from(t.querySelectorAll("tbody tr"))
        .map((tr) => Array.from(tr.querySelectorAll("th,td")).map((td) => clean(td.innerText)))
        .filter((cells) => cells.length >= 5 && !/없습니다/.test(cells.join("")));
    };
    return { registered: parseMoves(last2[0]), released: parseMoves(last2[1]) };
  });
}

const MOVE_HEADERS = ["등번호", "선수명", "포지션", "투타유형", "생년월일", "체격"];

function moveTable(rows) {
  const lines = [`| ${MOVE_HEADERS.join(" | ")} |`, `|${MOVE_HEADERS.map(() => "---").join("|")}|`];
  for (const r of rows) lines.push(`| ${r.join(" | ")} |`);
  return lines.join("\n");
}

const results = [];
let visited = 0;
await withBrowser(async (page) => {
  await page.goto("https://www.koreabaseball.com/Player/Register.aspx", {
    waitUntil: "domcontentloaded",
    timeout: 45000,
  });
  await page.waitForSelector("table.tNData", { timeout: 30000 });
  for (const code of REGISTER_TEAM_CODES) {
    const moves = await readTeam(page, code);
    visited += 1;
    if (moves.registered.length || moves.released.length) {
      results.push({ team: TEAM_NAME_BY_CODE[code], ...moves });
    }
    await sleep(500);
  }
});

if (visited < REGISTER_TEAM_CODES.length) {
  console.error(`Only visited ${visited}/${REGISTER_TEAM_CODES.length} teams — 실패.`);
  process.exit(1);
}

const parts = [`## ${dateIso}`, "", `갱신: ${kstStamp()} · extract-kbo-availability.mjs`, ""];
if (results.length === 0) {
  parts.push("변동 없음");
} else {
  for (const r of results) {
    parts.push(`### ${r.team}`, "");
    parts.push("**등록**", "");
    parts.push(r.registered.length ? moveTable(r.registered) : "없음", "");
    parts.push("**말소**", "");
    parts.push(r.released.length ? moveTable(r.released) : "없음", "");
  }
}
const block = parts.join("\n").replace(/\s+$/, "");

const path = `${DATA_DIR}/availability/${month}.md`;
let content = await readFileOrEmpty(path);
if (!content) {
  content = `# ${month} KBO 등록/말소\n\n> Register.aspx 당일 1군 등록/말소. 날짜당 1섹션, 전 팀 변동 없으면 "변동 없음".\n`;
}
content = replaceSection(content, `## ${dateIso}`, block);
await writeFileEnsured(path, content);
console.log(`Wrote availability ${dateIso}: ${results.length} teams with moves (visited ${visited}). → ${path}`);
