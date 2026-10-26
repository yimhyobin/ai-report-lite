#!/usr/bin/env node
// Claude Code 훅. 정해진 순간(세션 시작·요청 받음·알림·끝남·세션 종료)에만 불려 세션 카드 한 장을 쓴다.
// 도구를 쓸 때마다 불리지 않으므로 Claude 속도에 영향이 거의 없다. 어떤 경우에도 0으로 끝나 Claude 를 막지 않는다.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { EVENTS_DIR, SERVER_FILE, REPO_DIR, ensureDirs, today } from "../server/paths.mjs";
import { readConfig } from "../server/config.mjs";
import { readCard, writeCard, projectName } from "../server/sessions.mjs";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => { data += c; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", () => resolve(data));
    setTimeout(() => resolve(data), 1500); // stdin 이 안 닫혀도 멈추지 않는다
  });
}

const cut = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

function serverAlive() {
  try {
    if (!existsSync(SERVER_FILE)) return false;
    const { pid } = JSON.parse(readFileSync(SERVER_FILE, "utf8"));
    process.kill(pid, 0); return true;
  } catch { return false; }
}

function autoStartServer() {
  try {
    const child = spawn(process.execPath, [join(REPO_DIR, "server", "server.mjs")], { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
  } catch { /* 못 띄워도 훅은 성공으로 끝난다 */ }
}

async function main() {
  const raw = await readStdin();
  let p = {}; try { p = JSON.parse(raw || "{}"); } catch { p = {}; }
  const sid = String(p.session_id ?? "").trim();
  if (!sid) return;
  ensureDirs();
  const now = new Date().toISOString();
  const ev = String(p.hook_event_name ?? "");
  const card = readCard(sid) ?? { sessionId: sid, startedAt: now, state: "resting", waitingWhat: null, lastPrompt: null, events: 0 };
  card.cwd = p.cwd ?? card.cwd ?? "";
  card.project = projectName(card.cwd);
  if (p.transcript_path) card.transcriptPath = p.transcript_path;
  card.lastEventAt = now; card.lastEvent = ev; card.events = (card.events ?? 0) + 1;
  let line = ev;
  if (ev === "SessionStart") { card.state = card.state === "working" ? "working" : "resting"; card.endedAt = null; line = `세션 시작 (${p.source ?? ""})`; }
  else if (ev === "UserPromptSubmit") { card.state = "working"; card.waitingWhat = null; card.lastPrompt = cut(p.prompt, 140); line = `요청: ${card.lastPrompt}`; }
  else if (ev === "Notification") {
    const msg = cut(p.message ?? p.title ?? "", 160); const kind = String(p.notification_type ?? "");
    // 권한 요청·질문·오래 기다림 알림이면 '승인 대기'. 그 외 알림은 상태를 바꾸지 않는다.
    if (/permission|idle|input|question|approval|waiting/i.test(kind + " " + msg)) { card.state = "waiting"; card.waitingWhat = msg || "대표 답을 기다리는 중"; card.waitingSince = now; }
    line = `알림: ${msg}`;
  }
  else if (ev === "Stop") { card.state = "resting"; card.waitingWhat = null; line = "답 끝냄"; }
  else if (ev === "SessionEnd") { card.state = "gone"; card.endedAt = now; card.waitingWhat = null; line = `세션 종료 (${p.reason ?? ""})`; }
  else if (ev === "PreToolUse" || ev === "PostToolUse") { if (card.state !== "waiting") card.state = "working"; line = `도구: ${p.tool_name ?? ""}`; }
  writeCard(card);
  try { appendFileSync(join(EVENTS_DIR, `${today()}.jsonl`), JSON.stringify({ at: now, sid, project: card.project, event: ev, text: line }) + "\n", "utf8"); } catch { /* 무시 */ }
  const cfg = readConfig();
  if (cfg.autoStart && ev === "SessionStart" && !serverAlive()) autoStartServer();
}

main().catch(() => {}).finally(() => process.exit(0));
