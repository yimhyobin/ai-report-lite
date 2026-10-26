// 로컬 서버. 127.0.0.1 에만 붙고 Host 를 확인한다(다른 웹사이트가 읽어 가지 못하게). 외부 요청·CDN·분석 도구 없음.
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { join, extname } from "node:path";
import { REPO_DIR, SERVER_FILE, REPORTS_DIR, ensureDirs, today } from "./paths.mjs";
import { readConfig } from "./config.mjs";
import { listSessions } from "./sessions.mjs";
import { buildReport, toMarkdown, saveReport } from "./report.mjs";
import { demoState } from "./demo.mjs";

const DEMO = process.argv.includes("--demo");
const cfg = readConfig();
const WEB = join(REPO_DIR, "web");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8" };

function state() {
  if (DEMO) return demoState();
  const sessions = listSessions({ staleHours: cfg.staleHours, hide: cfg.hide });
  let report = buildReport({ sessions, config: cfg });
  // 자정~새벽 5시에 오늘 기록이 아직 없으면 어제 보고서를 보여 준다(퇴근 보고는 밤늦게 보는 일이 많다). 날짜는 그대로 표시된다.
  if (report.totals.projects === 0 && new Date().getHours() < 5) {
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yr = buildReport({ sessions, config: cfg, date: today(y) });
    if (yr.totals.projects > 0) report = { ...yr, carriedOver: true };
  }
  return { sessions, report, demo: false, config: { port: cfg.port, reportHour: cfg.reportHour } };
}

function hostOk(req) {
  const host = String(req.headers.host ?? "").split(":")[0];
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}

const server = createServer((req, res) => {
  if (!hostOk(req)) { res.writeHead(403); res.end("forbidden"); return; }
  const url = new URL(req.url, "http://127.0.0.1");
  const send = (code, type, body) => { res.writeHead(code, { "content-type": type, "cache-control": "no-store", "x-content-type-options": "nosniff" }); res.end(body); };
  try {
    if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
    if (url.pathname === "/ping") return send(200, TYPES[".json"], JSON.stringify({ ok: true, pid: process.pid, demo: DEMO }));
    if (url.pathname === "/api/state") return send(200, TYPES[".json"], JSON.stringify(state()));
    if (url.pathname === "/api/report") {
      const date = url.searchParams.get("date") || today();
      const r = DEMO ? demoState().report : buildReport({ date, config: cfg });
      return url.searchParams.get("format") === "md" ? send(200, TYPES[".md"], toMarkdown(r)) : send(200, TYPES[".json"], JSON.stringify(r));
    }
    if (url.pathname === "/api/save") { const r = DEMO ? demoState().report : buildReport({ config: cfg }); const p = DEMO ? null : saveReport(r); return send(200, TYPES[".json"], JSON.stringify({ saved: p })); }
    let file = url.pathname === "/" ? "/index.html" : url.pathname;
    if (file.includes("..")) return send(404, "text/plain", "no");
    const p = join(WEB, file);
    if (!p.startsWith(WEB) || !existsSync(p)) return send(404, "text/plain", "not found");
    return send(200, TYPES[extname(p)] ?? "application/octet-stream", readFileSync(p));
  } catch (e) {
    return send(500, "text/plain; charset=utf-8", `오류: ${String(e.message ?? e).slice(0, 200)}`);
  }
});

server.listen(cfg.port, "127.0.0.1", () => {
  ensureDirs();
  writeFileSync(SERVER_FILE, JSON.stringify({ pid: process.pid, port: cfg.port, startedAt: new Date().toISOString(), demo: DEMO }), "utf8");
  console.log(`ai-daily-report http://127.0.0.1:${cfg.port}${DEMO ? " (demo)" : ""}`);
});
server.on("error", (e) => { console.error("서버 시작 실패:", e.message); process.exit(1); });

// 하루 마감: reportHour 가 지나면 오늘 보고서를 한 번 파일로 남긴다(없을 때만).
if (!DEMO) {
  setInterval(() => {
    try {
      const d = new Date();
      if (d.getHours() < cfg.reportHour) return;
      const p = join(REPORTS_DIR, `${today()}.md`);
      if (!existsSync(p)) saveReport(buildReport({ config: cfg }));
    } catch { /* 다음 분에 다시 */ }
  }, 60 * 1000).unref();
}

const bye = () => { try { if (existsSync(SERVER_FILE)) { const s = JSON.parse(readFileSync(SERVER_FILE, "utf8")); if (s.pid === process.pid) unlinkSync(SERVER_FILE); } } catch { /* 무시 */ } process.exit(0); };
process.on("SIGINT", bye); process.on("SIGTERM", bye);
