import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const tmp = mkdtempSync(join(tmpdir(), "ai-report-hook-"));
const env = { ...process.env, AI_REPORT_HOME: join(tmp, "home"), CLAUDE_CONFIG_DIR: join(tmp, "claude") };
const hook = join(dirname(fileURLToPath(import.meta.url)), "..", "hooks", "report-hook.mjs");

function fire(payload) {
  const r = spawnSync(process.execPath, [hook], { input: JSON.stringify(payload), env, encoding: "utf8", timeout: 10000 });
  assert.equal(r.status, 0, `훅은 항상 0으로 끝난다: ${r.stderr}`);
}
const card = (sid) => JSON.parse(readFileSync(join(tmp, "home", "sessions", `${sid}.json`), "utf8"));

test("훅: 세션 시작 → 요청 → 권한 알림(승인 대기) → 끝남 → 종료 순서로 카드 상태가 바뀐다", () => {
  const base = { session_id: "h1", transcript_path: join(tmp, "h1.jsonl"), cwd: "/work/demo-proj" };
  fire({ ...base, hook_event_name: "SessionStart", source: "startup" });
  assert.equal(card("h1").state, "resting"); assert.equal(card("h1").project, "demo-proj");
  fire({ ...base, hook_event_name: "UserPromptSubmit", prompt: "테스트 돌려줘" });
  assert.equal(card("h1").state, "working"); assert.equal(card("h1").lastPrompt, "테스트 돌려줘");
  fire({ ...base, hook_event_name: "Notification", message: "Claude needs your permission to use Bash", notification_type: "permission_prompt" });
  assert.equal(card("h1").state, "waiting"); assert.match(card("h1").waitingWhat, /permission/);
  fire({ ...base, hook_event_name: "Notification", message: "작업 완료 알림" });
  assert.equal(card("h1").state, "waiting", "일반 알림은 상태를 바꾸지 않는다");
  fire({ ...base, hook_event_name: "Stop" });
  assert.equal(card("h1").state, "resting"); assert.equal(card("h1").waitingWhat, null);
  fire({ ...base, hook_event_name: "SessionEnd", reason: "exit" });
  assert.equal(card("h1").state, "gone");
  const events = readdirSync(join(tmp, "home", "events"));
  assert.equal(events.length, 1, "오늘 사건 파일 하나");
  assert.ok(readFileSync(join(tmp, "home", "events", events[0]), "utf8").split("\n").filter(Boolean).length >= 6);
});

test("훅: 깨진 입력·세션 id 없음에도 0으로 끝나고 아무것도 쓰지 않는다", () => {
  const r = spawnSync(process.execPath, [hook], { input: "not json", env, encoding: "utf8", timeout: 10000 });
  assert.equal(r.status, 0);
  assert.ok(!existsSync(join(tmp, "home", "sessions", "undefined.json")));
});
