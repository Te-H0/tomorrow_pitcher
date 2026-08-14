// 공통 유틸: KBO 공개 페이지 수집 파이프라인 (검증 운영 단계)
// - 브라우저 실행 헬퍼, KST 날짜 헬퍼, 팀코드 맵, md 테이블/섹션 upsert 헬퍼
// - 이 단계에서는 md 파일이 DB 역할이므로 "멱등 쓰기"가 핵심이다.
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// KBO 크롤 정중함: 기존 UA 문자열 유지, 요청 간 500ms 대기.
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

export const REQUEST_DELAY_MS = 500;

// KBO 팀코드 → 표시명. 게임센터 li.game-cont는 away_nm/home_nm를 직접 주므로
// 이 맵은 순위/등록말소처럼 코드만 있는 소스에서 사용한다.
export const TEAM_NAME_BY_CODE = {
  KT: "KT",
  LG: "LG",
  SS: "삼성",
  HT: "KIA",
  OB: "두산",
  LT: "롯데",
  HH: "한화",
  NC: "NC",
  SK: "SSG",
  WO: "키움",
};

// Register.aspx 팀 전환(fnSearchChange)에 쓰는 팀코드 순회 순서.
export const REGISTER_TEAM_CODES = ["SS", "LG", "KT", "HT", "OB", "HH", "NC", "LT", "SK", "WO"];

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// ---------------------------------------------------------------------------
// KST 날짜/시각 헬퍼 (러너는 UTC이므로 Asia/Seoul로 명시 계산)
// ---------------------------------------------------------------------------
function kstParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
}

// 오늘(KST) YYYYMMDD
export function kstToday(date = new Date()) {
  const p = kstParts(date);
  return `${p.year}${p.month}${p.day}`;
}

// 오늘 기준 offsetDays 만큼 이동한 YYYYMMDD (한국은 DST 없음)
export function kstYmdOffset(offsetDays, date = new Date()) {
  const p = kstParts(date);
  const base = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day));
  const d = new Date(base + offsetDays * 86400000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

// "YYYY-MM-DD HH:mm KST"
export function kstStamp(date = new Date()) {
  const p = kstParts(date);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} KST`;
}

// 임의의 YYYYMMDD 기준 offsetDays 이동 (한국은 DST 없음)
export function ymdOffset(ymd, offsetDays) {
  const base = Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(4, 6)) - 1, Number(ymd.slice(6, 8)));
  const d = new Date(base + offsetDays * 86400000);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}${m}${day}`;
}

// 두 YMD 사이 일수 (b - a)
export function daysBetween(a, b) {
  const t = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)));
  return Math.round((t(b) - t(a)) / 86400000);
}

// fromYmd~toYmd 구간이 걸치는 "YYYY-MM" 목록
export function monthsCovering(fromYmd, toYmd) {
  const set = new Set();
  for (let d = fromYmd; d <= toYmd; d = ymdOffset(d, 1)) set.add(monthOf(d));
  return [...set];
}

// md 테이블의 "MM.DD(요일)" 셀 + "YYYY-MM" → "YYYYMMDD"
export function ymdFromDateCell(dateCell, month) {
  const m = dateCell.match(/^(\d\d)\.(\d\d)/);
  return m ? `${month.slice(0, 4)}${m[1]}${m[2]}` : "";
}

// "20260719" → "2026-07"
export function monthOf(ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}`;
}

// "20260719" → "07.19(토)"
export function dateLabelFromYmd(ymd) {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${ymd.slice(4, 6)}.${ymd.slice(6, 8)}(${wd})`;
}

// "20260719" → "2026-07-19"
export function isoDate(ymd) {
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// 브라우저
// ---------------------------------------------------------------------------
export async function withBrowser(fn) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    page.setDefaultTimeout(45000);
    return await fn(page);
  } finally {
    await browser.close();
  }
}

export function gameCenterDateUrl(ymd) {
  return `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${ymd}`;
}

export function gameCenterReviewUrl(ymd, gameId) {
  return `https://www.koreabaseball.com/Schedule/GameCenter/Main.aspx?gameDate=${ymd}&gameId=${gameId}&section=REVIEW`;
}

// 게임센터 날짜 페이지의 li.game-cont 속성 + 예고/실제 선발 이름을 읽는다.
export async function readGameConts(page) {
  return page.evaluate(() => {
    const pitcherName = (root) => {
      if (!root) return "";
      const node = root.querySelector("p") || root;
      const clone = node.cloneNode(true);
      clone.querySelectorAll("span").forEach((s) => s.remove());
      return (clone.textContent || "").replace(/^선/, "").replace(/\s+/g, "").trim();
    };
    return Array.from(document.querySelectorAll("li.game-cont")).map((li) => {
      const attrs = {};
      for (const a of li.attributes) attrs[a.name] = a.value;
      delete attrs.style;
      return {
        attrs,
        cls: typeof li.className === "string" ? li.className : "",
        awayPitcher: pitcherName(li.querySelector(".team.away .today-pitcher")),
        homePitcher: pitcherName(li.querySelector(".team.home .today-pitcher")),
      };
    });
  });
}

// li.game-cont 상태 판별
export function gameState(cls) {
  if (/\bend\b/.test(cls)) return "end";
  if (/\bcancel\b/.test(cls)) return "cancel";
  return "scheduled";
}

// ---------------------------------------------------------------------------
// Markdown 테이블/섹션 헬퍼 (멱등 upsert의 기반)
// ---------------------------------------------------------------------------
export function mdCell(value) {
  return String(value ?? "").replaceAll("|", "/").replace(/\s+/g, " ").trim();
}

// 헤더/정렬/행 배열 → 마크다운 테이블 문자열
export function buildTable(headers, rows, aligns) {
  const sep = headers.map((_, i) => (aligns && aligns[i]) || "---");
  const lines = [`| ${headers.join(" | ")} |`, `|${sep.map((s) => `${s}`).join("|")}|`];
  for (const row of rows) {
    lines.push(`| ${row.map((c) => mdCell(c)).join(" | ")} |`);
  }
  return lines.join("\n");
}

// content에서 headerSignature(헤더행에 포함된 고유 문자열)를 가진 테이블의
// 데이터 행들을 셀 배열로 파싱한다. 없으면 빈 배열.
export function parseTableRows(content, headerSignature) {
  const lines = content.split("\n");
  let i = lines.findIndex((l) => l.trim().startsWith("|") && l.includes(headerSignature));
  if (i === -1) return [];
  // 헤더 다음의 구분선(---)을 건너뛴다.
  i += 1;
  if (i < lines.length && /^\s*\|[-:| ]+\|\s*$/.test(lines[i])) i += 1;
  const rows = [];
  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith("|")) break;
    const cells = line
      .slice(1, line.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((c) => c.trim());
    rows.push(cells);
  }
  return rows;
}

// keyFn으로 식별되는 행 upsert. newRows가 기존 행을 덮어쓴다. sortFn으로 정렬.
export function upsertRows(existingRows, newRows, keyFn, sortFn) {
  const map = new Map();
  for (const r of existingRows) map.set(keyFn(r), r);
  for (const r of newRows) map.set(keyFn(r), r);
  const merged = [...map.values()];
  if (sortFn) merged.sort(sortFn);
  return merged;
}

// content에서 "## heading" 으로 시작하는 섹션 하나를 newBlock으로 교체하거나 없으면 추가.
// heading은 정확 일치(라인 전체). newBlock은 heading 라인을 포함해야 한다.
export function replaceSection(content, heading, newBlock) {
  const lines = content.split("\n");
  const start = lines.findIndex((l) => l.trim() === heading);
  if (start === -1) {
    const trimmed = content.replace(/\s+$/, "");
    return `${trimmed}\n\n${newBlock}\n`;
  }
  let end = start + 1;
  for (; end < lines.length; end += 1) {
    if (/^##\s/.test(lines[end])) break;
  }
  const before = lines.slice(0, start).join("\n").replace(/\s+$/, "");
  const after = lines.slice(end).join("\n").replace(/^\s+/, "");
  const parts = [before, newBlock.replace(/\s+$/, "")];
  if (after) parts.push(after);
  return `${parts.join("\n\n")}\n`;
}

export async function readFileOrEmpty(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return "";
    throw error;
  }
}

export async function writeFileEnsured(path, content) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content.endsWith("\n") ? content : `${content}\n`);
}

export const DATA_DIR = "docs/data";
