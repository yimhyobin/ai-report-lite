import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { join } from "node:path";
import { SERVER_FILE, REPO_DIR } from "../server/paths.mjs";
import { readConfig } from "../server/config.mjs";

export function serverInfo() {
  if (!existsSync(SERVER_FILE)) return null;
  try {
    const s = JSON.parse(readFileSync(SERVER_FILE, "utf8"));
    try { process.kill(s.pid, 0); return s; } catch { unlinkSync(SERVER_FILE); return null; }
  } catch { return null; }
}

export async function ping(port) {
  try { const r = await fetch(`http://127.0.0.1:${port}/ping`, { signal: AbortSignal.timeout(1500) }); return r.ok ? await r.json() : null; } catch { return null; }
}

export function startServer({ demo = false } = {}) {
  const args = [join(REPO_DIR, "server", "server.mjs")]; if (demo) args.push("--demo");
  const child = spawn(process.execPath, args, { detached: true, stdio: "ignore", windowsHide: true });
  child.unref();
}

export async function waitUp(port, tries = 30) {
  for (let i = 0; i < tries; i += 1) { if (await ping(port)) return true; await new Promise((r) => setTimeout(r, 200)); }
  return false;
}

export function openBrowser(url) {
  try {
    if (process.platform === "win32") execSync(`start "" "${url}"`, { stdio: "ignore", shell: "cmd.exe" });
    else if (process.platform === "darwin") execSync(`open "${url}"`, { stdio: "ignore" });
    else execSync(`xdg-open "${url}"`, { stdio: "ignore" });
  } catch { console.log("브라우저를 못 열었습니다. 직접 여세요:", url); }
}

export function stopServer() {
  const s = serverInfo(); if (!s) return false;
  try { process.kill(s.pid); } catch { /* 이미 없음 */ }
  try { if (existsSync(SERVER_FILE)) unlinkSync(SERVER_FILE); } catch { /* 무시 */ }
  return true;
}

export const port = () => readConfig().port;
