# 퇴근 보고 (ai-daily-report)

Claude Code 창을 여러 개 띄워 놓고 일하다 보면 저녁에 이런 생각이 듭니다. "오늘 얘네가 뭘 한 거지?"
이 도구는 **AI 직원이 오늘 한 일을 보고서 한 장으로** 보여 주고, **지금 내 답을 기다리는 것**과 **결정할 것**을 한 화면에 모읍니다.

- 지금: 세션 하나가 직원 한 명. 일하는 중 / **내 답을 기다림(빨간 줄)** / 쉬는 중
- 오늘 한 일: 프로젝트별로 요청, 고친 파일, 실행한 명령(설명만), 조사, 물어본 것, 마지막 보고
- 지금 결정할 것: 승인 요청과 답 없는 질문만
- 보고서 복사 버튼 → 마크다운. 21시가 지나면 `~/.ai-daily-report/reports/날짜.md` 에 자동 저장

의존성 0, Node.js 18 이상, 맥·윈도우. 서버는 `127.0.0.1` 에만 열리고 대화 기록은 내 컴퓨터에서만 읽습니다. 모델을 부르지 않습니다.

![퇴근 보고 수달](web/img/otter-report-900.jpg)

캐릭터는 서류 가방을 들고 퇴근하는 수달입니다. 일할 때는 책상에 앉고, 내 답을 기다릴 때는 손을 듭니다.

## 설치는 Claude 에게 한마디

```bash
git clone https://github.com/yimhyobin/ai-report-lite.git
cd ai-report-lite
claude
```

Claude 에게 이렇게 말합니다.

```
퇴근 보고 설치해줘
```

Claude 가 `CLAUDE.md` 를 읽고 설정 백업 → 훅 추가 → 서버 실행 → 브라우저 열기까지 합니다. `http://127.0.0.1:4790` 이 열립니다.
직접 하려면 `node scripts/setup.mjs`.

설치 전에 구경만 하려면 `npm run demo` (가짜 데이터).

**이미 열려 있던 Claude 세션은 새 훅을 모릅니다.** `/exit` 뒤 `claude --continue` 로 다시 열면 승인 대기까지 잡힙니다.

## 어떻게 동작하나

```
Claude Code ──훅(세션 시작·요청·알림·끝남·종료)──▶ hooks/report-hook.mjs ──▶ ~/.ai-daily-report/sessions/<세션>.json
브라우저 ◀──5초마다── 로컬 서버(127.0.0.1:4790) ──▶ 세션 카드 + 대화 기록(jsonl) 끝부분 → 보고서
```

| 상태 | 근거 | 화면 |
|---|---|---|
| 일하는 중 | 요청을 받은 뒤(UserPromptSubmit) 아직 답을 끝내지 않음 | 초록 점 |
| 내 답을 기다림 | 권한 요청·질문 알림(Notification) 뒤 답이 없음 | 빨간 줄 + 무엇을 기다리는지 |
| 쉬는 중 | 답을 끝냄(Stop) | 회색 |
| 퇴근 | 세션 종료(SessionEnd) 또는 `staleHours`(기본 6시간) 넘게 조용함 | 화면에서 사라짐 |

훅은 도구를 쓸 때마다 불리지 않습니다. 몇 순간에만 불리므로 Claude 속도에 영향이 거의 없습니다.
보고서의 "오늘 한 일"은 대화 기록에서 **도구 이름·파일 이름·명령 설명·질문**만 뽑습니다. 명령 본문, 토큰, 비밀값은 화면에 나오지 않게 가립니다. 점수·진행률·추정은 넣지 않습니다. 기록에 없는 것은 보고서에도 없습니다.

## 명령

| 명령 | 하는 일 |
|---|---|
| `node scripts/setup.mjs` | 훅 설치 + 서버 실행 + 브라우저 열기 |
| `node scripts/start.mjs --open` | 서버 실행 후 브라우저 열기 (`--demo` 가짜 데이터) |
| `node scripts/stop.mjs` | 서버 끄기 |
| `node scripts/status.mjs` | 훅 설치 여부, 서버 상태, 세션 수 |
| `node scripts/report.mjs [YYYY-MM-DD] [--save]` | 터미널에서 보고서 보기/저장 |
| `node scripts/uninstall.mjs [--purge]` | 이 저장소가 넣은 훅만 제거 (+상태 폴더 삭제) |
| `npm test` | 시험 (진짜 설정은 건드리지 않음) |

## 설정 `~/.ai-daily-report/config.json`

```json
{ "port": 4790, "autoStart": true, "reportHour": 21, "staleHours": 6, "hide": [], "lang": "ko" }
```

| 키 | 뜻 |
|---|---|
| `port` | 서버 포트. 환경변수 `AI_REPORT_PORT` 가 우선 |
| `autoStart` | Claude 세션이 시작될 때 서버가 꺼져 있으면 자동으로 띄움 |
| `reportHour` | 이 시각이 지나면 오늘 보고서를 파일로 저장 |
| `staleHours` | 이만큼 조용한 세션은 퇴근으로 봄 |
| `hide` | 화면에 띄우지 않을 프로젝트(폴더 이름) |

## 안전

- `settings.json` 은 먼저 백업(`settings.json.bak-report-…`)하고 훅을 **추가만** 합니다. 지울 때도 이 저장소가 넣은 것만 지웁니다.
- 외부 서버, CDN, 분석 도구 없음. 서버는 Host 헤더를 확인해 다른 웹사이트가 읽어 가지 못하게 막습니다.
- 화면 공유 때 참고: 프로젝트 폴더 이름, 파일 이름, 명령 설명, 요청 첫 줄이 보입니다.

## 제거

```bash
node scripts/uninstall.mjs
```

## 라이선스와 고지

MIT. 이 프로젝트는 Anthropic 이 만들거나 보증한 것이 아닙니다. Claude 는 Anthropic 의 상표입니다. 코드는 있는 그대로 제공합니다.
