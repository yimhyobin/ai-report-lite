// 설치: Node 확인 → settings.json 백업 + 훅 추가 → 기본 설정 → 서버 실행 → 브라우저 열기
import { readSettings, backupSettings, addHooks, isInstalled, writeSettings, SETTINGS_FILE } from "../server/hooks-config.mjs";
import { writeDefaultConfig } from "../server/config.mjs";
import { ensureDirs } from "../server/paths.mjs";
import { serverInfo, startServer, waitUp, openBrowser } from "./common.mjs";

const major = Number(process.versions.node.split(".")[0]);
if (major < 18) { console.error(`Node.js 18 이상이 필요합니다 (지금 ${process.versions.node}).`); process.exit(1); }

let settings;
try { settings = readSettings(); }
catch (e) { console.error(`${SETTINGS_FILE} 을 읽지 못했습니다(JSON 오류). 손대지 않고 멈춥니다: ${e.message}`); process.exit(1); }

ensureDirs();
if (isInstalled(settings)) console.log("훅은 이미 설치돼 있습니다.");
else {
  const bak = backupSettings();
  writeSettings(addHooks(settings));
  console.log(`훅 추가 완료 → ${SETTINGS_FILE}${bak ? `\n백업: ${bak}` : ""}`);
}
const cfg = writeDefaultConfig();
if (!serverInfo()) { startServer(); const ok = await waitUp(cfg.port); console.log(ok ? `서버 실행: http://127.0.0.1:${cfg.port}` : "서버가 아직 안 떴습니다. node scripts/status.mjs 로 확인하세요."); }
else console.log(`서버는 이미 켜져 있습니다: http://127.0.0.1:${cfg.port}`);
openBrowser(`http://127.0.0.1:${cfg.port}`);
console.log("\n이미 열려 있던 Claude 세션은 새 훅을 모릅니다. /exit 뒤 claude --continue 로 다시 열면 정확히 잡힙니다.");
