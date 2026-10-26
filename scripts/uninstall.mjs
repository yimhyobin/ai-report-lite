// 이 저장소가 넣은 훅만 지우고 서버를 끈다. --purge 면 상태 폴더(~/.ai-daily-report)도 지운다.
import { rmSync, existsSync } from "node:fs";
import { readSettings, backupSettings, removeHooks, writeSettings, SETTINGS_FILE } from "../server/hooks-config.mjs";
import { HOME } from "../server/paths.mjs";
import { stopServer } from "./common.mjs";

stopServer();
try {
  const s = readSettings();
  const bak = backupSettings();
  writeSettings(removeHooks(s));
  console.log(`훅 제거 완료 → ${SETTINGS_FILE}${bak ? `\n백업: ${bak}` : ""}`);
} catch (e) { console.error(`설정 파일을 읽지 못해 훅을 지우지 못했습니다: ${e.message}`); }
if (process.argv.includes("--purge") && existsSync(HOME)) { rmSync(HOME, { recursive: true, force: true }); console.log(`상태 폴더 삭제: ${HOME}`); }
else console.log(`상태 폴더는 남겨 두었습니다(보고서 포함): ${HOME}  — 지우려면 --purge`);
