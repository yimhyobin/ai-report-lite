// ~/.claude/settings.json 에 우리 훅을 '추가만' 하고, 지울 때도 우리 것만 지운다. 손으로 고치지 않는다.
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SETTINGS_FILE, HOOK_FILE, HOOK_MARK, CLAUDE_DIR } from "./paths.mjs";

export const EVENTS = ["SessionStart", "UserPromptSubmit", "Notification", "Stop", "SessionEnd"];

export function hookCommand() {
  // 경로에 공백·한글이 있어도 되게 따옴표. 표식은 환경변수로 넣어 settings.json 에서 알아본다.
  return `node "${HOOK_FILE.replace(/\\/g, "/")}"`;
}

export function readSettings() {
  if (!existsSync(SETTINGS_FILE)) return {};
  const raw = readFileSync(SETTINGS_FILE, "utf8");
  if (!raw.trim()) return {};
  return JSON.parse(raw); // JSON 오류면 여기서 멈춘다 — 깨진 설정 위에 덮어쓰지 않기 위해
}

export function backupSettings() {
  if (!existsSync(SETTINGS_FILE)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = `${SETTINGS_FILE}.bak-report-${stamp}`;
  copyFileSync(SETTINGS_FILE, dest);
  return dest;
}

const isOurs = (h) => h && typeof h.command === "string" && (h.command.includes(HOOK_FILE.replace(/\\/g, "/")) || h.command.includes(HOOK_MARK) || /report-hook\.mjs/.test(h.command));

export function isInstalled(settings = readSettings()) {
  const hooks = settings.hooks ?? {};
  return EVENTS.every((ev) => (hooks[ev] ?? []).some((entry) => (entry.hooks ?? []).some(isOurs)));
}

export function addHooks(settings = readSettings()) {
  const hooks = settings.hooks ?? (settings.hooks = {});
  for (const ev of EVENTS) {
    const list = hooks[ev] ?? (hooks[ev] = []);
    if (list.some((entry) => (entry.hooks ?? []).some(isOurs))) continue;
    const entry = { hooks: [{ type: "command", command: hookCommand(), timeout: 5 }] };
    if (ev !== "Stop" && ev !== "SessionStart" && ev !== "SessionEnd") entry.matcher = "";
    list.push(entry);
  }
  return settings;
}

export function removeHooks(settings = readSettings()) {
  const hooks = settings.hooks ?? {};
  for (const ev of Object.keys(hooks)) {
    hooks[ev] = (hooks[ev] ?? []).map((entry) => ({ ...entry, hooks: (entry.hooks ?? []).filter((h) => !isOurs(h)) })).filter((entry) => entry.hooks.length > 0);
    if (hooks[ev].length === 0) delete hooks[ev];
  }
  if (Object.keys(hooks).length === 0) delete settings.hooks;
  return settings;
}

export function writeSettings(settings) {
  if (!existsSync(dirname(SETTINGS_FILE))) mkdirSync(dirname(SETTINGS_FILE), { recursive: true });
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + "\n", "utf8");
}

export { SETTINGS_FILE, CLAUDE_DIR };
