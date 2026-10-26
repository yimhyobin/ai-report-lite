import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 진짜 ~/.claude · ~/.ai-daily-report 를 건드리지 않도록 import 전에 임시 폴더로 돌린다.
const tmp = mkdtempSync(join(tmpdir(), "ai-report-test-"));
process.env.AI_REPORT_HOME = join(tmp, "home");
process.env.CLAUDE_CONFIG_DIR = join(tmp, "claude");

const { parseTranscript, describeTool } = await import("../server/transcript.mjs");
const { buildReport, toMarkdown } = await import("../server/report.mjs");
const { addHooks, removeHooks, isInstalled, writeSettings, readSettings } = await import("../server/hooks-config.mjs");
const { writeCard, listSessions, liveState } = await import("../server/sessions.mjs");

const now = new Date(2026, 9, 26, 15, 0, 0); // 로컬 2026-10-26 15:00
const iso = (h, m = 0) => new Date(2026, 9, 26, h, m).toISOString();
const line = (o) => JSON.stringify(o);

function fixture() {
  const p = join(tmp, "t.jsonl");
  const rows = [
    line({ type: "ai-title", aiTitle: "견적서 PDF 양식", sessionId: "s1" }),
    line({ type: "user", timestamp: iso(10), sessionId: "s1", cwd: "/work/invoice-tool", message: { role: "user", content: "견적서 PDF 양식 고쳐줘" } }),
    line({ type: "assistant", timestamp: iso(10, 1), sessionId: "s1", message: { role: "assistant", content: [{ type: "tool_use", name: "Read", input: { file_path: "/work/invoice-tool/invoice.html" } }] } }),
    line({ type: "assistant", timestamp: iso(10, 2), sessionId: "s1", message: { role: "assistant", content: [{ type: "tool_use", name: "Edit", input: { file_path: "/work/invoice-tool/invoice.html", old_string: "a", new_string: "b" } }] } }),
    line({ type: "assistant", timestamp: iso(10, 3), sessionId: "s1", message: { role: "assistant", content: [{ type: "tool_use", name: "Edit", input: { file_path: "/work/invoice-tool/invoice.html", old_string: "c", new_string: "d" } }] } }),
    line({ type: "assistant", timestamp: iso(10, 4), sessionId: "s1", message: { role: "assistant", content: [{ type: "tool_use", name: "Bash", input: { command: "node make-pdf.js --token=abc123secret", description: "PDF 미리보기 생성" } }] } }),
    line({ type: "user", timestamp: iso(10, 5), sessionId: "s1", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "ok" }] } }),
    line({ type: "assistant", timestamp: iso(10, 6), sessionId: "s1", message: { role: "assistant", content: [{ type: "tool_use", name: "AskUserQuestion", input: { questions: [{ question: "부가세 칸을 어디에 둘까요?" }] } }] } }),
    line({ type: "assistant", timestamp: iso(10, 7), sessionId: "s1", message: { role: "assistant", content: [{ type: "text", text: "양식을 고쳤습니다. 부가세 칸 위치만 정해 주세요." }] } }),
    line({ type: "user", timestamp: new Date(2026, 9, 25, 9).toISOString(), sessionId: "s1", message: { role: "user", content: "어제 요청(오늘 보고서에 안 들어가야 함)" } }),
    line({ type: "cost-state", totalLinesAdded: 31, totalLinesRemoved: 12, totalCostUSD: 0.4 }),
  ];
  writeFileSync(p, rows.join("\n") + "\n", "utf8");
  return p;
}

test("대화 기록에서 오늘치 요청·파일·명령 설명·질문만 뽑는다(명령 본문·토큰은 안 보인다)", () => {
  const p = fixture();
  const start = new Date(2026, 9, 26).getTime();
  const t = parseTranscript(p, { sinceMs: start, untilMs: start + 86400000 - 1 });
  assert.equal(t.title, "견적서 PDF 양식");
  assert.equal(t.prompts, 1, "어제 요청은 제외");
  assert.deepEqual(t.edits.map((e) => [e.name, e.count]), [["invoice.html", 2]]);
  assert.deepEqual(t.runs, ["PDF 미리보기 생성"]);
  assert.ok(!JSON.stringify(t).includes("abc123secret"), "토큰 노출 없음");
  assert.equal(t.reads, 1);
  assert.equal(t.questions[0], "부가세 칸을 어디에 둘까요?");
  assert.equal(t.linesAdded, 31);
  assert.match(t.lastAssistantText, /양식을 고쳤습니다/);
});

test("도구 설명: 명령은 설명만, 설명이 없으면 명령을 80자로 자르고 비밀값은 가린다", () => {
  assert.ok(!describeTool("Bash", { command: "curl -H 'Authorization: Bearer sk-abcdefghijklmnop' https://x" }).text.includes("abcdefghijklmnop"), "비밀값 가림");
  assert.equal(describeTool("Write", { file_path: "C:\\a\\b\\c.md" }).text, "c.md");
});

test("보고서: 프로젝트별로 묶고, 승인 대기와 답 없는 질문을 '지금 결정할 것'에 올린다", () => {
  const p = fixture();
  writeCard({ sessionId: "s1", cwd: "/work/invoice-tool", project: "invoice-tool", transcriptPath: p, state: "resting", startedAt: iso(10), lastEventAt: iso(14, 50) });
  writeCard({ sessionId: "s2", cwd: "/work/shop", project: "shop", transcriptPath: join(tmp, "none.jsonl"), state: "waiting", waitingWhat: "Bash 실행 허용?", waitingSince: iso(14, 55), startedAt: iso(14), lastEventAt: iso(14, 55) });
  writeCard({ sessionId: "s3", cwd: "/work/old", project: "old", state: "gone", startedAt: iso(1), lastEventAt: iso(2) });
  const sessions = listSessions({ staleHours: 6, nowMs: now.getTime() });
  assert.equal(sessions.find((s) => s.sessionId === "s2").live, "waiting");
  const r = buildReport({ date: "2026-10-26", sessions, nowMs: now.getTime() });
  assert.equal(r.projects.length, 2, "오늘 활동한 프로젝트만");
  const inv = r.projects.find((x) => x.project === "invoice-tool");
  assert.equal(inv.editCount, 1); assert.equal(inv.runs[0], "PDF 미리보기 생성");
  assert.ok(r.decisions.some((d) => d.kind === "승인 대기" && d.project === "shop"));
  assert.ok(r.decisions.some((d) => d.kind === "질문" && d.project === "invoice-tool"));
  const md = toMarkdown(r);
  assert.match(md, /# 2026-10-26 퇴근 보고/); assert.match(md, /invoice\.html×2/); assert.match(md, /승인 대기 1건/);
  assert.ok(!/진행률|%/.test(md), "진행률 같은 꾸밈 없음");
});

test("신선도: staleHours 를 넘긴 세션은 퇴근으로 본다", () => {
  const c = { state: "working", lastEventAt: iso(1) };
  assert.equal(liveState(c, { nowMs: now.getTime(), staleHours: 6 }), "gone");
  assert.equal(liveState(c, { nowMs: now.getTime(), staleHours: 24 }), "working");
});

test("훅 설치: 기존 훅은 두고 우리 것만 추가, 두 번 해도 한 번만, 제거하면 우리 것만 사라진다", () => {
  const base = { permissions: { allow: ["Bash(ls)"] }, hooks: { Stop: [{ hooks: [{ type: "command", command: "node other-hook.mjs" }] }] } };
  writeSettings(base);
  const once = addHooks(readSettings()); writeSettings(once);
  const twice = addHooks(readSettings()); writeSettings(twice);
  const s = readSettings();
  assert.ok(isInstalled(s));
  assert.equal(s.hooks.Stop.length, 2, "기존 Stop 훅 + 우리 것");
  assert.equal(s.hooks.Notification.length, 1);
  assert.deepEqual(s.permissions, base.permissions, "다른 설정은 그대로");
  const removed = removeHooks(readSettings()); writeSettings(removed);
  const after = readSettings();
  assert.ok(!isInstalled(after));
  assert.equal(after.hooks.Stop.length, 1, "남의 훅은 남는다");
  assert.equal(after.hooks.Notification, undefined);
  assert.ok(existsSync(join(tmp, "claude", "settings.json")));
  assert.ok(readFileSync(join(tmp, "claude", "settings.json"), "utf8").includes("other-hook"));
});
