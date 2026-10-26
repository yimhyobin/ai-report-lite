// 오늘 한 일 보고서. 세션 카드 + 대화 기록(오늘치)만으로 만든다. 추측·진행률·점수는 넣지 않는다.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseTranscript } from "./transcript.mjs";
import { listSessions } from "./sessions.mjs";
import { REPORTS_DIR, ensureDirs, today } from "./paths.mjs";

export function dayBounds(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  return { sinceMs: start, untilMs: start + 24 * 3600 * 1000 - 1 };
}

const hhmm = (ms) => { const d = new Date(ms); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function buildReport({ date = today(), sessions = null, config = {}, nowMs = Date.now(), parse = parseTranscript } = {}) {
  const { sinceMs, untilMs } = dayBounds(date);
  const cards = sessions ?? listSessions({ staleHours: config.staleHours ?? 6, hide: config.hide ?? [], nowMs });
  const byProject = new Map();
  const decisions = []; // 내일(지금) 결정할 것: 승인 대기 + 답 없는 질문
  for (const c of cards) {
    const t = c.transcriptPath && existsSync(c.transcriptPath) ? parse(c.transcriptPath, { sinceMs, untilMs }) : null;
    const touchedToday = t && (t.prompts > 0 || t.edits.length > 0 || t.runs.length > 0 || t.research.length > 0);
    const lastEv = Date.parse(c.lastEventAt ?? "") || 0;
    const activeToday = touchedToday || (lastEv >= sinceMs && lastEv <= untilMs && c.live !== "gone");
    if (!activeToday) continue;
    const key = c.project;
    const g = byProject.get(key) ?? { project: key, cwd: c.cwd, sessions: [], edits: new Map(), runs: [], research: [], questions: [], prompts: 0, promptSamples: [], firstAt: null, lastAt: null, lastText: null, title: null, linesAdded: 0, linesRemoved: 0, reads: 0, subagents: 0, live: [] };
    g.sessions.push(c.sessionId); g.live.push(c.live);
    if (t) {
      g.title = g.title ?? t.title; g.prompts += t.prompts; g.promptSamples.push(...t.promptSamples);
      for (const e of t.edits) g.edits.set(e.file, (g.edits.get(e.file) ?? 0) + e.count);
      g.runs.push(...t.runs); g.research.push(...t.research); g.questions.push(...t.questions);
      g.reads += t.reads; g.subagents += t.subagents;
      if (t.firstAt) g.firstAt = g.firstAt === null ? t.firstAt : Math.min(g.firstAt, t.firstAt);
      if (t.lastAt) { if (g.lastAt === null || t.lastAt > g.lastAt) { g.lastAt = t.lastAt; g.lastText = t.lastAssistantText; } }
      if (typeof t.linesAdded === "number") g.linesAdded += t.linesAdded;
      if (typeof t.linesRemoved === "number") g.linesRemoved += t.linesRemoved;
    }
    if (c.live === "waiting") decisions.push({ project: key, kind: "승인 대기", text: c.waitingWhat ?? "권한 요청 또는 질문에 답이 필요합니다", since: c.waitingSince ?? c.lastEventAt, sessionId: c.sessionId });
    byProject.set(key, g);
  }
  const projects = [...byProject.values()].map((g) => ({
    project: g.project, cwd: g.cwd, title: g.title, sessions: g.sessions.length,
    state: g.live.includes("waiting") ? "waiting" : g.live.includes("working") ? "working" : g.live.includes("resting") ? "resting" : "gone",
    span: g.firstAt && g.lastAt ? `${hhmm(g.firstAt)}~${hhmm(g.lastAt)}` : null,
    prompts: g.prompts, promptSamples: g.promptSamples.slice(0, 3),
    edits: [...g.edits.entries()].map(([file, count]) => ({ file, name: file.split(/[\\/]/).pop(), count })).sort((a, b) => b.count - a.count).slice(0, 14),
    editCount: g.edits.size, runs: [...new Set(g.runs)].slice(-10), research: g.research.slice(0, 6), questions: g.questions.slice(-5),
    reads: g.reads, subagents: g.subagents, linesAdded: g.linesAdded, linesRemoved: g.linesRemoved, lastText: g.lastText,
  })).sort((a, b) => (b.lastAt ?? 0) - (a.lastAt ?? 0));
  // 답 없는 질문: 마지막 도구가 질문이고 지금 쉬는 중이면 '답을 기다리는 질문'으로 올린다
  for (const p of projects) {
    if (p.questions.length > 0 && p.state === "resting") decisions.push({ project: p.project, kind: "질문", text: p.questions[p.questions.length - 1], since: null, sessionId: null });
  }
  return {
    date, generatedAt: new Date(nowMs).toISOString(),
    totals: { projects: projects.length, prompts: projects.reduce((s, p) => s + p.prompts, 0), edits: projects.reduce((s, p) => s + p.editCount, 0), runs: projects.reduce((s, p) => s + p.runs.length, 0), waiting: cards.filter((c) => c.live === "waiting").length },
    projects, decisions,
  };
}

export function toMarkdown(r) {
  const L = [];
  L.push(`# ${r.date} 퇴근 보고`);
  L.push("");
  L.push(`프로젝트 ${r.totals.projects}개 · 요청 ${r.totals.prompts}건 · 고친 파일 ${r.totals.edits}개 · 실행 ${r.totals.runs}건${r.totals.waiting ? ` · **승인 대기 ${r.totals.waiting}건**` : ""}`);
  L.push("");
  if (r.decisions.length) {
    L.push("## 지금 결정할 것");
    for (const d of r.decisions) L.push(`- [${d.kind}] ${d.project}: ${d.text}`);
    L.push("");
  }
  L.push("## 오늘 한 일");
  if (!r.projects.length) L.push("- 오늘 기록된 작업이 없습니다.");
  for (const p of r.projects) {
    L.push(`### ${p.project}${p.title ? ` — ${p.title}` : ""}${p.span ? ` (${p.span})` : ""}`);
    if (p.promptSamples.length) L.push(`- 요청: ${p.promptSamples.join(" / ")}${p.prompts > p.promptSamples.length ? ` 외 ${p.prompts - p.promptSamples.length}건` : ""}`);
    if (p.edits.length) L.push(`- 고친 파일(${p.editCount}): ${p.edits.map((e) => e.count > 1 ? `${e.name}×${e.count}` : e.name).join(", ")}`);
    if (p.runs.length) L.push(`- 실행: ${p.runs.join(" / ")}`);
    if (p.research.length) L.push(`- 조사: ${p.research.join(" / ")}`);
    if (p.questions.length) L.push(`- 물어본 것: ${p.questions.join(" / ")}`);
    if (p.lastText) L.push(`- 마지막 보고: ${p.lastText}`);
    L.push("");
  }
  L.push(`_로컬에서 대화 기록만 읽어 만든 보고서입니다. 밖으로 나가지 않습니다._`);
  return L.join("\n");
}

export function saveReport(r) {
  ensureDirs();
  const p = join(REPORTS_DIR, `${r.date}.md`);
  writeFileSync(p, toMarkdown(r), "utf8");
  return p;
}
