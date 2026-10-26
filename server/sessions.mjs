// 세션 카드: 훅이 쓴 ~/.ai-daily-report/sessions/*.json 을 읽어 지금 상태를 만든다.
// 상태는 저장된 사건으로만 정한다. 타이머로 꾸며 내지 않는다.
//   working  마지막 사건이 '요청 받음'(UserPromptSubmit) 또는 승인 뒤 다시 일하는 중
//   waiting  권한 요청·질문 알림(Notification) 뒤 아직 답이 없음  ← 빨간 표시
//   resting  답을 끝냄(Stop) 또는 세션만 열어 둠
//   gone     세션 종료(SessionEnd) 또는 staleHours 넘게 조용함
import { readdirSync, readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import { join, basename } from "node:path";
import { SESSIONS_DIR, ensureDirs } from "./paths.mjs";

export function readCards() {
  ensureDirs();
  const cards = [];
  for (const f of readdirSync(SESSIONS_DIR)) {
    if (!f.endsWith(".json")) continue;
    try { cards.push(JSON.parse(readFileSync(join(SESSIONS_DIR, f), "utf8"))); } catch { /* 깨진 카드는 건너뜀 */ }
  }
  return cards;
}

export function writeCard(card) {
  ensureDirs();
  const p = join(SESSIONS_DIR, `${card.sessionId}.json`);
  const tmp = p + ".tmp";
  writeFileSync(tmp, JSON.stringify(card, null, 1), "utf8");
  renameSync(tmp, p);
}

export function readCard(sessionId) {
  const p = join(SESSIONS_DIR, `${sessionId}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

export function projectName(cwd) {
  const s = String(cwd ?? "").replace(/[\\/]+$/, "");
  return basename(s) || s || "(알 수 없음)";
}

// 화면용 상태: 저장된 state 에 신선도만 적용
export function liveState(card, { nowMs = Date.now(), staleHours = 6 } = {}) {
  if (card.state === "gone") return "gone";
  const last = Date.parse(card.lastEventAt ?? card.startedAt ?? "") || 0;
  if (nowMs - last > staleHours * 3600 * 1000) return "gone";
  return card.state ?? "resting";
}

export function listSessions({ staleHours = 6, hide = [], nowMs = Date.now() } = {}) {
  return readCards()
    .map((c) => ({ ...c, project: c.project ?? projectName(c.cwd), live: liveState(c, { nowMs, staleHours }) }))
    .filter((c) => !hide.includes(c.project))
    .sort((a, b) => (Date.parse(b.lastEventAt ?? 0) || 0) - (Date.parse(a.lastEventAt ?? 0) || 0));
}
