// 과거 실제 선발/경기 결과 백필 (gameId 기반)
//  → docs/data/starters/actual/YYYY-MM.md
//  → docs/data/games/YYYY-MM.md
//
// 왜 별도 스크립트인가:
//   GameCenter 날짜 페이지는 서비스 윈도우 밖의 과거 날짜를 가까운 유효일로 clamp한다.
//   그래서 날짜 기반인 extract-kbo-review.mjs 는 과거 날짜에 "경기 없음"으로 끝난다.
//   대신 schedule/YYYY-MM.md 에 이미 gameId가 있으므로, 그 gameId로 REVIEW 페이지에 직접 접속한다.
//
// 파싱·출력 형식은 extract-kbo-review.mjs 와 동일하다(scripts/lib/review.mjs 공유).
//
// 사용법:
//   node scripts/backfill-kbo-review.mjs 2026-06              # 해당 월 전체
//   node scripts/backfill-kbo-review.mjs 20260608 20260707     # 날짜 범위(월 경계 넘어도 됨)
//
// 멱등: 이미 actual 본문/취소 섹션/games 섹션에 있는 gameId는 건너뛴다.
//       중간에 끊겨도 재실행하면 남은 것부터 이어서 수집한다(월 단위로 중간 저장).
import {
  DATA_DIR,
  kstStamp,
  monthOf,
  parseTableRows,
  readFileOrEmpty,
  replaceSection,
  sleep,
  upsertRows,
  withBrowser,
  writeFileEnsured,
} from "./lib/kbo.mjs";
import {
  actualRow,
  byGameId,
  emptyGamesFile,
  gameSection,
  gotoAndParseReview,
  isBlankActualRow,
  normalizeActualRows,
  normalizeCancelRows,
  recordedIds,
  renderActual,
} from "./lib/review.mjs";

const SCRIPT = "backfill-kbo-review.mjs";
const USAGE = "Usage: node scripts/backfill-kbo-review.mjs <YYYY-MM> | <YYYYMMDD> <YYYYMMDD>";

// --- 인자 파싱 -------------------------------------------------------------
const [arg1, arg2] = process.argv.slice(2);
let months = [];
let fromYmd = "";
let toYmd = "";

if (arg1 && /^\d{4}-\d{2}$/.test(arg1) && !arg2) {
  months = [arg1];
  fromYmd = `${arg1.replace("-", "")}01`;
  toYmd = `${arg1.replace("-", "")}31`;
} else if (arg1 && arg2 && /^\d{8}$/.test(arg1) && /^\d{8}$/.test(arg2)) {
  if (arg1 > arg2) {
    console.error("시작일이 종료일보다 늦습니다.");
    process.exit(1);
  }
  fromYmd = arg1;
  toYmd = arg2;
  // 범위가 걸치는 모든 월
  const seen = new Set();
  for (let y = Number(fromYmd.slice(0, 4)), m = Number(fromYmd.slice(4, 6)); ; ) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (seen.has(key)) break;
    seen.add(key);
    if (key === monthOf(toYmd)) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  months = [...seen];
} else {
  console.error(USAGE);
  process.exit(1);
}

// --- schedule에서 대상 경기 수집 -------------------------------------------
// schedule row: [날짜, 시간, 원정, 홈, 구장, 상태, gameId]
// 날짜 라벨은 "MM.DD(요일)" 이므로 월 정보는 파일명(month)에서 가져온다.
const FINISHED = new Set(["종료"]);

function ymdOf(month, dateLabel) {
  const md = dateLabel.match(/^(\d{2})\.(\d{2})/);
  if (!md) return "";
  return `${month.slice(0, 4)}${md[1]}${md[2]}`;
}

const targetsByMonth = new Map(); // month → { finished: [], cancelled: [], noGameId: [] }

for (const month of months) {
  const scheduleContent = await readFileOrEmpty(`${DATA_DIR}/schedule/${month}.md`);
  if (!scheduleContent.trim()) {
    console.warn(`schedule/${month}.md 없음 — 건너뜀.`);
    continue;
  }
  const rows = parseTableRows(scheduleContent, "gameId");
  const finished = [];
  const cancelled = [];
  const noGameId = [];
  for (const r of rows) {
    const [dateLabel, , awayName, homeName, stadium, status, gameId = ""] = r;
    const ymd = ymdOf(month, dateLabel);
    if (!ymd || ymd < fromYmd || ymd > toYmd) continue;
    const game = { ymd, gameId: gameId.trim(), awayName, homeName, stadium, status, dateLabel };
    if (FINISHED.has(status)) {
      if (game.gameId) finished.push(game);
      else noGameId.push(game); // 종료인데 gameId 없음 = schedule 갱신 필요
    } else if (status && status !== "예정" && status !== "미정") {
      // 우천취소/노게임 등: ACTUAL 미생성, 취소 섹션에만 기록(gameId 있을 때만 키를 잡을 수 있다)
      if (game.gameId) cancelled.push(game);
      else noGameId.push(game);
    }
  }
  targetsByMonth.set(month, { finished, cancelled, noGameId });
}

const totalFinished = [...targetsByMonth.values()].reduce((n, t) => n + t.finished.length, 0);
if (totalFinished === 0 && [...targetsByMonth.values()].every((t) => t.cancelled.length === 0)) {
  console.log("대상 경기 없음 (schedule에 해당 기간의 종료 경기가 없거나 gameId 미수집).");
  process.exit(0);
}

// --- 월별 수집 -------------------------------------------------------------
const failures = []; // { gameId, ymd, reason }
let grandNew = 0;
let grandSkip = 0;

await withBrowser(async (page) => {
  for (const [month, targets] of targetsByMonth) {
    const actualPath = `${DATA_DIR}/starters/actual/${month}.md`;
    const gamesPath = `${DATA_DIR}/games/${month}.md`;
    const existingActual = await readFileOrEmpty(actualPath);
    const existingGames = await readFileOrEmpty(gamesPath);
    const recorded = recordedIds(existingActual, existingGames);

    const pending = targets.finished.filter((g) => !recorded.end.has(g.gameId));
    const newCancel = targets.cancelled.filter((g) => !recorded.cancel.has(g.gameId));
    const skipped =
      targets.finished.length - pending.length + (targets.cancelled.length - newCancel.length);
    grandSkip += skipped;

    console.log(
      `\n[${month}] 종료 ${targets.finished.length}건 · 취소 ${targets.cancelled.length}건 · ` +
        `이미 기록 ${skipped}건 → 신규 대상 ${pending.length + newCancel.length}건`,
    );
    if (targets.noGameId.length > 0) {
      console.log(`  (gameId 없는 행 ${targets.noGameId.length}건은 수집 불가 — schedule 재수집 필요)`);
    }
    if (pending.length === 0 && newCancel.length === 0) {
      console.log(`  신규 0 — 파일 미변경.`);
      continue;
    }

    const actualRows = [];
    const gameSections = [];
    const total = pending.length;

    for (let i = 0; i < total; i += 1) {
      const game = pending[i];
      const tag = `[${month}] ${i + 1}/${total} ${game.dateLabel} ${game.awayName}@${game.homeName} ${game.gameId}`;
      try {
        const review = await gotoAndParseReview(page, game.ymd, game.gameId);
        // 선발이 한쪽이라도 빈 값이면(REVIEW 미제공·미게시) 기록하지 않고 실패 처리 후 계속.
        // 빈 값을 기록하면 멱등 스킵에 영구 고착되므로 재실행 때 다시 시도하게 남겨둔다.
        const row = actualRow(game, review);
        if (isBlankActualRow(row)) {
          failures.push({ gameId: game.gameId, ymd: game.ymd, reason: "REVIEW 선발 미확정(빈 값)" });
          console.log(`${tag} — 실패(선발 빈 값), 계속 진행`);
        } else {
          actualRows.push(row);
          gameSections.push(gameSection(game, review));
          console.log(`${tag} — OK`);
        }
      } catch (error) {
        failures.push({ gameId: game.gameId, ymd: game.ymd, reason: error.message?.split("\n")[0] ?? String(error) });
        console.log(`${tag} — 실패(${error.message?.split("\n")[0]}), 계속 진행`);
      }
      await sleep(500); // 크롤 정중함: 요청 간 500ms
    }

    const cancelRows = newCancel.map((g) => [
      g.dateLabel,
      g.gameId,
      g.awayName,
      g.homeName,
      g.stadium,
      g.status || "경기 취소",
    ]);

    if (actualRows.length === 0 && cancelRows.length === 0) {
      console.log(`[${month}] 신규 수집 0 — 파일 미변경.`);
      continue;
    }

    // actual/YYYY-MM.md upsert (구형식 파일은 신형식으로 정규화되어 저장된다)
    const mergedActual = upsertRows(normalizeActualRows(existingActual), actualRows, (r) => r[1], byGameId);
    const mergedCancel = upsertRows(normalizeCancelRows(existingActual), cancelRows, (r) => r[1], byGameId);
    await writeFileEnsured(actualPath, renderActual(month, mergedActual, mergedCancel, SCRIPT));

    // games/YYYY-MM.md 섹션 upsert
    let gamesContent = existingGames || emptyGamesFile(month, SCRIPT);
    gamesContent = gamesContent.replace(/^마지막 갱신:.*$/m, `마지막 갱신: ${kstStamp()} · 생성 스크립트: ${SCRIPT}`);
    for (const s of gameSections) gamesContent = replaceSection(gamesContent, s.heading, s.block);
    await writeFileEnsured(gamesPath, gamesContent);

    grandNew += actualRows.length + cancelRows.length;
    console.log(
      `[${month}] 저장 완료: 실제 선발 신규 ${actualRows.length}건 · 취소 신규 ${cancelRows.length}건 ` +
        `(총 행 ${mergedActual.length} / 취소 ${mergedCancel.length}).`,
    );
  }
});

// --- 요약 ------------------------------------------------------------------
console.log(`\n=== 백필 요약 ===`);
console.log(`대상 기간: ${fromYmd} ~ ${toYmd} (${months.join(", ")})`);
console.log(`신규 수집 ${grandNew}건 · 스킵(이미 기록) ${grandSkip}건 · 실패 ${failures.length}건`);
if (failures.length > 0) {
  console.log(`\n실패한 gameId:`);
  for (const f of failures) console.log(`  - ${f.gameId} (${f.ymd}): ${f.reason}`);
  console.log(`\n재실행하면 실패분만 다시 시도한다(이미 수집된 건은 자동 스킵).`);
}
