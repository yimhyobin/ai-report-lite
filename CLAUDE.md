# ai-daily-report — Claude Code 작업 지침

이 저장소는 **Claude Code 세션을 "AI 직원"으로 보고, 지금 하는 일·내 답을 기다리는 것·오늘 한 일 보고서·지금 결정할 것을 한 화면에 보여 주는 로컬 웹 화면**이다.
사용자가 이 폴더에서 설치·실행을 부탁하면 아래 절차를 그대로 따른다. 사용자의 언어로 답한다.

## 사용자가 이렇게 말하면
| 사용자 말 (예) | 할 일 |
|---|---|
| "퇴근 보고 설치해줘", "설치", "set up", "install" | 아래 **설치 절차** |
| "퇴근 보고 열어줘", "켜줘", "open", "start" | `node scripts/start.mjs --open` |
| "꺼줘", "stop" | `node scripts/stop.mjs` |
| "상태 봐줘", "안 보여", "status" | `node scripts/status.mjs` 결과를 읽고 **문제 해결** 참고 |
| "오늘 뭐 했어", "보고서", "report" | `node scripts/report.mjs` 를 실행해 그 내용을 그대로 보여 준다(요약하지 않는다) |
| "데모", "demo" | `node scripts/start.mjs --demo --open` (가짜 데이터) |
| "지워줘", "uninstall" | `node scripts/uninstall.mjs` (상태 폴더까지면 `--purge`) |

## 설치 절차
1. `node --version` 으로 18 이상인지 확인한다. 없거나 낮으면 설치를 **제안만** 한다(사용자 동의 없이 시스템 프로그램을 설치하지 않는다).
2. `node scripts/setup.mjs` 를 실행한다. 이 스크립트가 하는 일:
   - Claude 설정(`~/.claude/settings.json`, `CLAUDE_CONFIG_DIR` 가 있으면 그 폴더)을 **백업한 뒤** 이 저장소의 훅을 **추가**한다. 기존 훅은 그대로 둔다.
   - `~/.ai-daily-report/config.json` 이 없으면 기본 설정을 만든다.
   - 로컬 서버(127.0.0.1:4790)를 띄우고 브라우저를 연다.
3. 사용자에게 짧게 알린다: 주소 `http://127.0.0.1:4790`, **이미 열려 있던 Claude 세션은 새 훅을 모르므로** `/exit` 뒤 `claude --continue` 로 다시 열어야 승인 대기까지 잡힌다는 것, 서버는 세션이 시작될 때 자동으로 다시 뜬다는 것(`autoStart`).

**`settings.json` 을 손으로 고치지 않는다.** 항상 `scripts/setup.mjs` / `scripts/uninstall.mjs` 를 쓴다. 설정 파일이 JSON 오류로 읽히지 않으면 setup 은 멈춘다 — 그 오류를 사용자에게 보여 주고 고칠지 묻는다.

## 문제 해결
- 화면에 아무도 없다 → `node scripts/status.mjs`. 열린 Claude 세션이 없으면 정상이다.
- 승인 대기가 안 잡힌다 → 설치 전에 열어 둔 세션이다. 그 세션을 다시 연다.
- 포트가 겹친다 → `~/.ai-daily-report/config.json` 의 `port` 를 바꾸고 `node scripts/stop.mjs && node scripts/start.mjs --open`.
- 특정 프로젝트를 숨기고 싶다 → config.json 의 `hide` 에 폴더 이름.
- 보고서 저장 시각을 바꾸고 싶다 → config.json 의 `reportHour`(기본 21).

## 개발 규칙 (이 저장소를 고칠 때)
- 외부 의존성 0 — Node.js 18+ 표준 라이브러리만. 화면도 CDN·웹폰트 없이 오프라인으로 돈다.
- 모델을 부르지 않는다. 보고서는 대화 기록에서 뽑은 사실(파일 이름·명령 설명·질문)만으로 만든다. 점수·진행률·추정을 넣지 않는다.
- 서버는 127.0.0.1 에만 붙고 Host 헤더를 검사한다. 이 성질을 깨는 변경 금지.
- 화면에는 도구 이름·파일 이름·명령 **설명**만 보인다. 명령 본문·토큰·비밀값은 보이지 않게 유지한다.
- 시험: `npm test`. 시험은 `CLAUDE_CONFIG_DIR`·`AI_REPORT_HOME` 을 임시 폴더로 둬 진짜 설정을 건드리지 않는다.
