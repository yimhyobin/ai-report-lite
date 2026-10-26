// Claude Code 대화 기록(jsonl)에서 "오늘 한 일" 재료만 뽑는다. 읽기 전용, 끝부분만 읽는다(기본 12MB).
// 뽑는 것: 세션 제목(ai-title), 사용자 요청 수·마지막 요청, 도구 사용(고친 파일·실행한 명령 설명·조사·질문), 마지막 답 요약, 줄 수 변화.
import { openSync, readSync, fstatSync, closeSync } from "node:fs";
import { basename } from "node:path";

const TAIL_BYTES = 12 * 1024 * 1024;

export function readTail(path, bytes = TAIL_BYTES) {
  const fd = openSync(path, "r");
  try {
    const size = fstatSync(fd).size;
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    readSync(fd, buf, 0, buf.length, start);
    let text = buf.toString("utf8");
    if (start > 0) text = text.slice(text.indexOf("\n") + 1); // 잘린 첫 줄 버림
    return text;
  } finally { closeSync(fd); }
}

const cut = (s, n) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const secret = (s) => String(s ?? "").replace(/(access_token|api[_-]?key|token|secret|password|passwd|bearer)[=:\s]+[^\s&"']+/gi, "$1=***").replace(/sk-[A-Za-z0-9_-]{8,}/g, "sk-***");

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter((c) => c && c.type === "text").map((c) => c.text).join("\n");
}

// 도구 하나 → 활동 한 줄. 화면에 보이는 건 도구 이름·파일 이름·명령 설명뿐(명령 본문은 넣지 않음).
export function describeTool(name, input = {}) {
  const n = String(name ?? "");
  const file = input.file_path ?? input.notebook_path ?? input.path ?? "";
  if (/^(Edit|Write|NotebookEdit|MultiEdit)$/.test(n)) return { kind: "edit", text: basename(String(file)), file: String(file) };
  if (/^(Read|Glob|Grep)$/.test(n)) return { kind: "read", text: basename(String(file || input.pattern || "")) };
  if (/^(Bash|PowerShell)$/.test(n)) return { kind: "run", text: cut(secret(input.description || input.command || ""), 80) };
  if (/^(WebSearch|WebFetch)$/.test(n)) return { kind: "research", text: cut(input.query || input.url || "", 80) };
  if (/^AskUserQuestion$/.test(n)) {
    const qs = Array.isArray(input.questions) ? input.questions.map((q) => q.question).filter(Boolean) : [];
    return { kind: "question", text: cut(qs.join(" / ") || "질문", 160) };
  }
  if (/^(Agent|Task|Workflow)$/.test(n)) return { kind: "subagent", text: cut(input.description || input.prompt || "하위 작업", 80) };
  if (/^(TodoWrite|TaskCreate|TaskUpdate)$/.test(n)) return { kind: "plan", text: "할 일 정리" };
  return { kind: "other", text: n };
}

// 하루치만 추리기 위해 날짜 경계를 받는다(로컬 자정 기준 ms). sinceMs 가 없으면 전부.
export function parseTranscript(path, { sinceMs = 0, untilMs = Infinity } = {}) {
  const out = {
    title: null, lastPrompt: null, prompts: 0, promptSamples: [],
    edits: [], runs: [], research: [], questions: [], reads: 0, subagents: 0, others: 0,
    lastAssistantText: null, firstAt: null, lastAt: null, linesAdded: null, linesRemoved: null, costUSD: null,
    lastToolName: null,
  };
  let text;
  try { text = readTail(path); } catch { return out; }
  const seenEdit = new Map();
  for (const line of text.split("\n")) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    const t = o.type;
    if (t === "ai-title" && o.aiTitle) { out.title = cut(o.aiTitle, 80); continue; }
    if (t === "cost-state") { out.linesAdded = o.totalLinesAdded ?? null; out.linesRemoved = o.totalLinesRemoved ?? null; out.costUSD = o.totalCostUSD ?? null; continue; }
    if (t !== "user" && t !== "assistant") continue;
    const ms = Date.parse(o.timestamp ?? "");
    if (Number.isFinite(ms) && (ms < sinceMs || ms > untilMs)) continue;
    if (o.isSidechain) { continue; } // 하위 작업자 대화는 요약에서 뺀다(개수만 세고 싶으면 subagent 도구로 센다)
    if (Number.isFinite(ms)) { out.firstAt = out.firstAt ?? ms; out.lastAt = ms; }
    const msg = o.message ?? {};
    if (t === "user") {
      if (o.isMeta) continue;
      const content = msg.content;
      const isToolResult = Array.isArray(content) && content.some((c) => c && c.type === "tool_result");
      if (isToolResult) continue;
      const txt = textOf(content);
      const tt = txt.trim();
      // 시스템이 끼워 넣은 사용자 줄(작업 알림·시스템 안내·명령 출력)은 사람의 요청이 아니다
      if (!tt || /^<[a-z][a-z0-9-]*[ >]/i.test(tt) || /^\[SYSTEM NOTIFICATION/.test(tt)) continue;
      out.prompts += 1; out.lastPrompt = cut(txt, 140);
      if (out.promptSamples.length < 5) out.promptSamples.push(cut(txt, 100));
      continue;
    }
    // assistant
    const content = Array.isArray(msg.content) ? msg.content : [];
    for (const c of content) {
      if (!c) continue;
      if (c.type === "text" && c.text && c.text.trim()) out.lastAssistantText = cut(c.text, 300);
      if (c.type !== "tool_use") continue;
      out.lastToolName = c.name;
      const d = describeTool(c.name, c.input ?? {});
      if (d.kind === "edit") { if (d.text) { seenEdit.set(d.file || d.text, (seenEdit.get(d.file || d.text) ?? 0) + 1); } }
      else if (d.kind === "run") { if (d.text) out.runs.push(d.text); }
      else if (d.kind === "research") { if (d.text) out.research.push(d.text); }
      else if (d.kind === "question") out.questions.push(d.text);
      else if (d.kind === "read") out.reads += 1;
      else if (d.kind === "subagent") out.subagents += 1;
      else out.others += 1;
    }
  }
  out.edits = [...seenEdit.entries()].map(([file, count]) => ({ file, name: basename(file), count }));
  // 같은 명령 설명 반복은 한 번만, 최근 것이 위로
  out.runs = [...new Set(out.runs.reverse())].reverse();
  out.research = [...new Set(out.research)];
  return out;
}
