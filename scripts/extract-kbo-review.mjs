// 종료 경기 실제 선발 + 경기 결과 상세 수집 (날짜 기반)
//  → docs/data/starters/actual/YYYY-MM.md (실제 선발, end 경기만)
//  → docs/data/games/YYYY-MM.md (스코어보드+투수 전원+타자 기록)
// 소스: GameCenter 날짜 페이지 1회 로드 → 미기록 end 경기만 REVIEW. cancel 경기는 ACTUAL 미생성(취소/노게임 기록).
// 조기 종료: 기존 산출물에서 이미 기록된 gameId를 파악해 재접속하지 않는다. 신규 0 + pending 0이면 즉시 no-op.
// 인자: 생략 시 오늘(KST), "yesterday" → KST 기준 어제(자정 넘긴 미종료 경기 익일 백필용), 또는 YYYYMMDD.
//
// 과거 날짜(서비스 윈도우 밖)는 이 스크립트로 수집할 수 없다(날짜 페이지가 clamp됨).
// 그 경우는 schedule의 gameId로 직접 REVIEW에 붙는 scripts/backfill-kbo-review.mjs 를 쓴다.
import { appendFile } from "node:fs/promises";
import {
  DATA_DIR,
  dateLabelFromYmd,
  gameCenterDateUrl,
  gameState,
  kstStamp,
  kstToday,
  kstYmdOffset,
  monthOf,
  readFileOrEmpty,
  readGameConts,
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
  normalizeActualRows,
  normalizeCancelRows,
  recordedIds,
  renderActual,
} from "./lib/review.mjs";

const SCRIPT = "extract-kbo-review.mjs";

const rawArg = process.argv[2];
const ymd = rawArg === "yesterday" ? kstYmdOffset(-1) : (rawArg ?? kstToday());
if (!/^\d{8}$/.test(ymd)) {
  console.error("Usage: node scripts/extract-kbo-review.mjs [YYYYMMDD|yesterday]");
  process.exit(1);
}
const month = monthOf(ymd);

// GITHUB_OUTPUT(Actions 스텝 출력)이 있으면 collected/pending을 append.
async function emitStepOutputs(collected, pending) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  await appendFile(out, `collected=${collected}\npending=${pending}\n`);
}

// ---------------------------------------------------------------------------
// 기존 산출물에서 이미 기록된 gameId를 먼저 파악한다(멱등·조기 종료의 근거).
const actualPath = `${DATA_DIR}/starters/actual/${month}.md`;
const gamesPath = `${DATA_DIR}/games/${month}.md`;
const existingActual = await readFileOrEmpty(actualPath);
const existingGames = await readFileOrEmpty(gamesPath);
const recorded = recordedIds(existingActual, existingGames);

const result = await withBrowser(async (page) => {
  await page.goto(gameCenterDateUrl(ymd), { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4000);
  // GameCenter 날짜 페이지는 서비스 윈도우 밖의 과거 날짜를 가장 가까운 유효일로 clamp한다.
  // 요청 날짜와 g_dt가 다른 경우(=clamp)는 해당 날짜 데이터가 아니므로 버린다.
  const games = (await readGameConts(page)).filter((g) => g.attrs.g_dt === ymd);

  const actualRows = [];
  const cancelRows = [];
  const gameSections = [];
  let pendingCount = 0; // 예정·진행중·서스펜디드 (아직 ACTUAL 없음)
  let skipCount = 0; // 이미 기록돼 재접속하지 않은 경기
  let newEndAttempted = 0; // 미기록 end 경기 REVIEW 시도 수 (DOM 계약 검증용)

  for (const g of games) {
    const state = gameState(g.cls);
    const gid = g.attrs.g_id;
    if (state === "cancel") {
      if (recorded.cancel.has(gid)) {
        skipCount += 1;
        continue;
      }
      cancelRows.push([
        dateLabelFromYmd(g.attrs.g_dt),
        gid,
        g.attrs.away_nm,
        g.attrs.home_nm,
        g.attrs.s_nm,
        "경기 취소",
      ]);
      continue;
    }
    if (state !== "end") {
      pendingCount += 1; // 예정/진행 중/서스펜디드 — 다음 회차 또는 익일 백필 대상
      continue;
    }
    // end 경기: 이미 기록됐으면 재접속하지 않는다.
    if (recorded.end.has(gid)) {
      skipCount += 1;
      continue;
    }
    newEndAttempted += 1;

    const game = {
      ymd: g.attrs.g_dt,
      gameId: gid,
      awayName: g.attrs.away_nm,
      homeName: g.attrs.home_nm,
      stadium: g.attrs.s_nm,
    };
    const review = await gotoAndParseReview(page, game.ymd, game.gameId);

    actualRows.push(actualRow(game, review));
    gameSections.push(gameSection(game, review));
    await sleep(500);
  }

  return { gamesTotal: games.length, pendingCount, skipCount, newEndAttempted, actualRows, cancelRows, gameSections };
});

if (result.gamesTotal === 0) {
  console.log(`No games scheduled on ${ymd}. (해당 날짜 경기 없음) — 정상 종료.`);
  await emitStepOutputs(0, 0);
  process.exit(0);
}
if (result.newEndAttempted > 0 && result.actualRows.length === 0) {
  console.error(`Attempted ${result.newEndAttempted} finished games but parsed 0 actual starters — DOM 계약 의심.`);
  process.exit(1);
}

const newCollected = result.actualRows.length + result.cancelRows.length;
console.log(
  `${ymd}: 신규 수집 ${result.actualRows.length}건, 신규 취소 ${result.cancelRows.length}건, ` +
    `잔여(pending) ${result.pendingCount}건, 스킵 ${result.skipCount}건 (총 ${result.gamesTotal}경기).`,
);
await emitStepOutputs(newCollected, result.pendingCount);

// 신규가 없으면 파일을 건드리지 않는다(멱등: 갱신 시각 라인만 바뀌어 diff 나는 것 방지).
if (newCollected === 0) {
  if (result.pendingCount === 0) {
    console.log("오늘 경기 전부 처리 완료 — 신규 없음.");
  } else {
    console.log(`신규 없음 · 잔여 ${result.pendingCount}건은 다음 회차/익일 백필 대상 — 정상 종료.`);
  }
  process.exit(0);
}

// actual/YYYY-MM.md upsert (신규 end 행 + 신규 취소 행)
const mergedActual = upsertRows(normalizeActualRows(existingActual), result.actualRows, (r) => r[1], byGameId);
const mergedCancel = upsertRows(normalizeCancelRows(existingActual), result.cancelRows, (r) => r[1], byGameId);
await writeFileEnsured(actualPath, renderActual(month, mergedActual, mergedCancel, SCRIPT));

// games/YYYY-MM.md 섹션 교체
let gamesContent = existingGames || emptyGamesFile(month, SCRIPT);
// 최신 갱신 시각 라인 교체
gamesContent = gamesContent.replace(/^마지막 갱신:.*$/m, `마지막 갱신: ${kstStamp()} · 생성 스크립트: ${SCRIPT}`);
for (const s of result.gameSections) {
  gamesContent = replaceSection(gamesContent, s.heading, s.block);
}
await writeFileEnsured(gamesPath, gamesContent);

console.log(
  `Wrote ${actualPath} + ${gamesPath} (신규 수집 ${result.actualRows.length} · 신규 취소 ${result.cancelRows.length}).`,
);
