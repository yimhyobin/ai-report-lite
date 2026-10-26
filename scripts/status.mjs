import { readSettings, isInstalled, SETTINGS_FILE } from "../server/hooks-config.mjs";
import { listSessions } from "../server/sessions.mjs";
import { readConfig } from "../server/config.mjs";
import { HOME } from "../server/paths.mjs";
import { serverInfo, ping } from "./common.mjs";

const cfg = readConfig();
let installed = false, err = null;
try { installed = isInstalled(readSettings()); } catch (e) { err = e.message; }
console.log(`훅 설치: ${err ? `설정 파일 읽기 실패 (${err})` : installed ? "됨" : "안 됨"} — ${SETTINGS_FILE}`);
const s = serverInfo(); const alive = s ? await ping(s.port) : null;
console.log(`서버: ${alive ? `켜짐 http://127.0.0.1:${s.port} (pid ${s.pid}${s.demo ? ", 데모" : ""})` : "꺼짐"}`);
const sessions = listSessions({ staleHours: cfg.staleHours, hide: cfg.hide });
console.log(`세션 카드: ${sessions.length}개 (일하는 중 ${sessions.filter((x) => x.live === "working").length} · 기다림 ${sessions.filter((x) => x.live === "waiting").length} · 쉼 ${sessions.filter((x) => x.live === "resting").length} · 퇴근 ${sessions.filter((x) => x.live === "gone").length})`);
for (const x of sessions.slice(0, 10)) console.log(`  - ${x.project} [${x.live}] ${x.waitingWhat ?? x.lastPrompt ?? ""}`);
console.log(`상태 폴더: ${HOME}`);
