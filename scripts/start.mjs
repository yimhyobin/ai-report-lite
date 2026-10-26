import { serverInfo, startServer, waitUp, openBrowser, stopServer, port } from "./common.mjs";
const demo = process.argv.includes("--demo");
const open = process.argv.includes("--open");
const cur = serverInfo();
if (cur && Boolean(cur.demo) !== demo) { stopServer(); await new Promise((r) => setTimeout(r, 300)); }
if (!serverInfo()) { startServer({ demo }); const ok = await waitUp(port()); console.log(ok ? `서버 실행: http://127.0.0.1:${port()}${demo ? " (데모)" : ""}` : "서버가 뜨지 않았습니다. 포트가 겹치면 ~/.ai-daily-report/config.json 의 port 를 바꾸세요."); }
else console.log(`이미 켜져 있습니다: http://127.0.0.1:${port()}`);
if (open) openBrowser(`http://127.0.0.1:${port()}`);
