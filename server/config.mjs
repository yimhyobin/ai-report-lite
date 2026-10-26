import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { CONFIG_FILE, ensureDirs } from "./paths.mjs";

export const DEFAULT_CONFIG = {
  port: 4790,          // 서버 포트. 환경변수 AI_REPORT_PORT 가 우선
  autoStart: true,     // Claude 세션이 시작될 때 서버가 꺼져 있으면 훅이 띄운다
  reportHour: 21,      // 이 시각이 지나면 오늘 보고서를 reports/ 에 파일로 남긴다
  staleHours: 6,       // 이만큼 조용한 세션은 '퇴근'으로 본다
  hide: [],            // 화면에 띄우지 않을 프로젝트(폴더 이름)
  lang: "ko",
};

export function readConfig() {
  let cfg = {};
  if (existsSync(CONFIG_FILE)) {
    try { cfg = JSON.parse(readFileSync(CONFIG_FILE, "utf8")); } catch { cfg = {}; }
  }
  const merged = { ...DEFAULT_CONFIG, ...cfg };
  if (process.env.AI_REPORT_PORT) merged.port = Number(process.env.AI_REPORT_PORT) || merged.port;
  return merged;
}

export function writeDefaultConfig() {
  ensureDirs();
  if (!existsSync(CONFIG_FILE)) writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", "utf8");
  return readConfig();
}
