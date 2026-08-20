// 공식 예고 선발 수집 → docs/data/starters/official/YYYY-MM.md
// 소스: GameCenter 날짜 페이지 li.game-cont 속성(start_ck=1 인 경기만).
// 인자 생략 시 오늘+내일(KST). gameId당 1행 upsert, 예고 교체 시 변경 이력 기록.
import {
  DATA_DIR,
  dateLabelFromYmd,
  gameCenterDateUrl,
  kstStamp,
  kstToday,
  kstYmdOffset,
  monthOf,
  parseTableRows,
  readFileOrEmpty,
  readGameConts,
  sleep,
  upsertRows,
  withBrowser,
  writeFileEnsured,
} from "./lib/kbo.mjs";

const MAIN_SIG = "원정 예고선발";
const LOG_SIG = "이전 → 이후";

function targetDates() {
  const arg = process.argv[2];
  if (arg) {
    if (!/^\d{8}$/.test(arg)) {
      console.error("Usage: node scripts/extract-kbo-preview.mjs [YYYYMMDD]");
      process.exit(1);
    }
    return [arg];
  }
  return [kstToday(), kstYmdOffset(1)];
}

// 대상 날짜에 경기가 편성돼 있었는지(취소 포함) 일정 데이터로 확인한다.
// 일정 파일이 아직 없으면(월 경계 등) 판단 불가이므로 null.
async function scheduledGameCount(ymd) {
  const content = await readFileOrEmpty(`${DATA_DIR}/schedule/${monthOf(ymd)}.md`);
  if (!content) return null;
  const label = dateLabelFromYmd(ymd);
  return parseTableRows(content, "구장").filter((r) => r[0] === label).length;
}

function renderFile(month, rows, logRows) {
  const header = [
    `# ${month} KBO 공식 예고 선발`,
    "",
    `마지막 갱신: ${kstStamp()} · 생성 스크립트: extract-kbo-preview.mjs`,
    "",
    "> GameCenter 날짜 페이지 `li.game-cont` 속성(start_ck=1)에서 수집한 공식 예고 선발. 신뢰순위 OFFICIAL_ANNOUNCED.",
    "",
    "| 날짜 | gameId | 원정 | 원정 예고선발 | 원정 playerId | 홈 | 홈 예고선발 | 홈 playerId | 최초수집(KST) | 최종확인(KST) |",
    "|---|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of rows) header.push(`| ${r.join(" | ")} |`);
  header.push("", "## 변경 이력", "");
  header.push("| 시각 | gameId | 팀 | 이전 → 이후 |");
  header.push("|---|---|---|---|");
  for (const r of logRows) header.push(`| ${r.join(" | ")} |`);
  return `${header.join("\n")}\n`;
}

const dates = targetDates();
let totalGames = 0;
const seenByDate = new Map(); // ymd → GameCenter에서 읽어낸 경기 수(예고 여부 무관)
const byMonth = new Map(); // month → { rows: [], log: [] }

await withBrowser(async (page) => {
  for (const ymd of dates) {
    await page.goto(gameCenterDateUrl(ymd), { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(4000);
    // 과거 날짜 clamp 방어: 요청 날짜와 g_dt가 일치하는 경기만.
    const games = (await readGameConts(page)).filter((g) => g.attrs.g_dt === ymd);
    seenByDate.set(ymd, games.length);
    const stamp = kstStamp();

    for (const g of games) {
      // 경기 시작 후에는 away_p_id/home_p_id가 예고 선발이 아니라 현재 투수로 바뀐다
      // (07.18 라이브 수집 오염 실측). 경기 전(game_sc=1) 상태에서만 예고로 신뢰한다.
      if (g.attrs.game_sc !== "1") continue;
      if (g.attrs.start_ck !== "1") continue; // 예고 발표된 경기만
      const gameId = g.attrs.g_id;
      const month = monthOf(g.attrs.g_dt);
      if (!byMonth.has(month)) {
        const existing = await readFileOrEmpty(`${DATA_DIR}/starters/official/${month}.md`);
        byMonth.set(month, {
          existingRows: parseTableRows(existing, MAIN_SIG),
          existingLog: parseTableRows(existing, LOG_SIG),
          newRows: [],
          newLog: [],
        });
      }
      const bucket = byMonth.get(month);
      const prev = bucket.existingRows.find((r) => r[1] === gameId);
      const firstSeen = prev ? prev[8] : stamp;

      // 경기가 시작되면 today-pitcher 표시가 지워질 수 있다. 이미 확보한 예고 이름을
      // 빈값으로 덮어쓰지 않도록, 새 값이 비어있으면 기존 값을 유지한다.
      const awayPitcher = g.awayPitcher || (prev ? prev[3] : "");
      const homePitcher = g.homePitcher || (prev ? prev[6] : "");
      const awayPid = g.attrs.away_p_id ?? (prev ? prev[4] : "") ?? "";
      const homePid = g.attrs.home_p_id ?? (prev ? prev[7] : "") ?? "";

      // 예고 교체 감지 (기존 이름과 다르고 새 이름이 있으면 변경 이력)
      if (prev) {
        if (g.awayPitcher && prev[3] && g.awayPitcher !== prev[3]) {
          bucket.newLog.push([stamp, gameId, g.attrs.away_nm, `${prev[3]} → ${g.awayPitcher}`]);
        }
        if (g.homePitcher && prev[6] && g.homePitcher !== prev[6]) {
          bucket.newLog.push([stamp, gameId, g.attrs.home_nm, `${prev[6]} → ${g.homePitcher}`]);
        }
      }

      bucket.newRows.push([
        dateLabelFromYmd(g.attrs.g_dt),
        gameId,
        g.attrs.away_nm,
        awayPitcher,
        awayPid,
        g.attrs.home_nm,
        homePitcher,
        homePid,
        firstSeen,
        stamp,
      ]);
      totalGames += 1;
    }
    await sleep(500);
  }
});

if (totalGames === 0) {
  // 예고 0건은 대부분 정상이다: 경기 없는 날(월요일/전면취소)이거나 아직 예고 발표 전.
  // 이걸 실패로 올리면 하루 6회 수집 중 이른 회차가 매번 실패해 알림이 무의미해진다.
  // 진짜 고장은 "일정상 경기가 편성됐는데 GameCenter에서 한 경기도 못 읽은" 경우로 좁혀서 잡는다.
  const broken = [];
  for (const ymd of dates) {
    if ((seenByDate.get(ymd) ?? 0) > 0) continue; // 경기는 읽었고 예고만 없음 → 정상
    const scheduled = await scheduledGameCount(ymd);
    if (scheduled) broken.push(`${ymd}(일정 ${scheduled}경기)`);
  }
  if (broken.length > 0) {
    console.error(
      `GameCenter에서 경기를 하나도 읽지 못했다: ${broken.join(", ")}. 페이지 구조/로딩 점검 필요.`,
    );
    process.exit(1);
  }
  const detail = dates
    .map((ymd) => `${ymd}: 경기 ${seenByDate.get(ymd) ?? 0}건`)
    .join(", ");
  console.log(`예고 선발 신규 수집 없음 (${detail}) — 경기 없음 또는 예고 발표 전. no-op.`);
}

for (const [month, bucket] of byMonth) {
  const rows = upsertRows(bucket.existingRows, bucket.newRows, (r) => r[1], (a, b) =>
    a[1].localeCompare(b[1]),
  );
  const log = [...bucket.existingLog, ...bucket.newLog];
  await writeFileEnsured(`${DATA_DIR}/starters/official/${month}.md`, renderFile(month, rows, log));
  console.log(
    `official/${month}.md: ${bucket.newRows.length} games upsert (total ${rows.length}), ${bucket.newLog.length} change-log rows added.`,
  );
}
