# End-of-Day Report for Claude Code (ai-daily-report)

Run several Claude Code windows all day and by evening you wonder: "What did they actually do today?"
This tool gives you **a one-page end-of-day report from your AI workers**, plus **what is waiting for your answer right now**.

- **Now**: one session = one worker. Working / **waiting for you (red)** / resting
- **Today's work**: per project — requests, files changed, commands run (description only), research, questions asked, last message
- **Decide now**: only permission requests and unanswered questions
- "Copy report" button → Markdown. After 21:00 the day's report is saved to `~/.ai-daily-report/reports/<date>.md`

Zero dependencies, Node.js 18+, macOS and Windows. The server binds to `127.0.0.1` only and reads transcripts on your machine only. It never calls a model.

![otter](web/img/otter-report-900.jpg)

The mascot is an otter heading home with a briefcase. It sits at a desk while working and raises a paw while waiting for your answer.

## Install by asking Claude

```bash
git clone https://github.com/yimhyobin/ai-report-lite.git
cd ai-report-lite
claude
```

Then tell Claude:

```
set up the end-of-day report
```

Claude reads `CLAUDE.md`, backs up your settings, adds the hooks, starts the server and opens `http://127.0.0.1:4790`.
Manual: `node scripts/setup.mjs`. Preview with fake data: `npm run demo`.

**Sessions opened before installing do not know the new hooks.** `/exit` and `claude --continue` to pick them up, including the waiting state.

## How it works

```
Claude Code ──hooks (SessionStart · UserPromptSubmit · Notification · Stop · SessionEnd)──▶ hooks/report-hook.mjs ──▶ ~/.ai-daily-report/sessions/<session>.json
Browser ◀──every 5 s── local server (127.0.0.1:4790) ──▶ session cards + tail of the transcript (jsonl) → report
```

| State | Evidence | Screen |
|---|---|---|
| Working | a prompt was received and no Stop yet | green dot |
| Waiting for you | permission / question notification with no answer | red bar + what it is waiting for |
| Resting | answer finished (Stop) | grey |
| Gone | SessionEnd, or quiet longer than `staleHours` (default 6 h) | removed |

Hooks fire only at those moments, not on every tool call, so Claude's speed is unaffected.
The report takes **tool names, file names, command descriptions and questions** from the transcript. Command bodies, tokens and secrets are masked. No scores, no progress bars, no guesses: if it is not in the transcript, it is not in the report.

## Commands

| Command | What it does |
|---|---|
| `node scripts/setup.mjs` | install hooks + start server + open browser |
| `node scripts/start.mjs --open` | start server and open browser (`--demo` for fake data) |
| `node scripts/stop.mjs` | stop server |
| `node scripts/status.mjs` | hook status, server status, session count |
| `node scripts/report.mjs [YYYY-MM-DD] [--save]` | print / save the report in the terminal |
| `node scripts/uninstall.mjs [--purge]` | remove only this repo's hooks (+ delete state folder) |
| `npm test` | tests (never touch your real settings) |

## Config `~/.ai-daily-report/config.json`

```json
{ "port": 4790, "autoStart": true, "reportHour": 21, "staleHours": 6, "hide": [], "lang": "ko" }
```

## Safety

- `settings.json` is backed up first (`settings.json.bak-report-…`) and hooks are **added only**; uninstall removes only ours.
- No external servers, CDNs or analytics. The server checks the Host header so other websites cannot read it.
- When screen-sharing: project folder names, file names, command descriptions and the first line of requests are visible.

## License and notice

MIT. Not made or endorsed by Anthropic. Claude is a trademark of Anthropic. Provided as is.
