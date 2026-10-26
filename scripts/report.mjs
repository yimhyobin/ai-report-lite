// 터미널에서 보고서 보기/저장. 사용: node scripts/report.mjs [YYYY-MM-DD] [--save]
import { buildReport, toMarkdown, saveReport } from "../server/report.mjs";
import { readConfig } from "../server/config.mjs";
import { today } from "../server/paths.mjs";

const date = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? today();
const r = buildReport({ date, config: readConfig() });
process.stdout.write(toMarkdown(r) + "\n");
if (process.argv.includes("--save")) console.log(`\n저장: ${saveReport(r)}`);
