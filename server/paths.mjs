// 경로 한 곳. 환경변수로 바꿀 수 있어 시험 때 진짜 ~/.claude 를 건드리지 않는다.
//   AI_REPORT_HOME   상태 폴더 (기본 ~/.ai-daily-report)
//   CLAUDE_CONFIG_DIR Claude 설정 폴더 (기본 ~/.claude)
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync, existsSync } from "node:fs";

export const REPO_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const HOME = process.env.AI_REPORT_HOME || join(homedir(), ".ai-daily-report");
export const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude");
export const SETTINGS_FILE = join(CLAUDE_DIR, "settings.json");
export const SESSIONS_DIR = join(HOME, "sessions");
export const EVENTS_DIR = join(HOME, "events");
export const REPORTS_DIR = join(HOME, "reports");
export const CONFIG_FILE = join(HOME, "config.json");
export const SERVER_FILE = join(HOME, "server.json");
export const HOOK_FILE = join(REPO_DIR, "hooks", "report-hook.mjs");
export const HOOK_MARK = "ai-daily-report"; // settings.json 안에서 우리 훅을 알아보는 표식(명령 문자열에 들어 있음)

export function ensureDirs() {
  for (const d of [HOME, SESSIONS_DIR, EVENTS_DIR, REPORTS_DIR]) if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

export function today(now = new Date()) {
  // 로컬 날짜 YYYY-MM-DD (보고서는 사용자의 하루 기준)
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
