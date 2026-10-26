// 데모: 가짜 세션 3개와 가짜 하루 기록. 실제 ~/.claude 는 읽지 않는다.
export function demoState(nowMs = Date.now()) {
  const iso = (m) => new Date(nowMs - m * 60000).toISOString();
  const sessions = [
    { sessionId: "demo-1", project: "shop-site", cwd: "/work/shop-site", state: "waiting", live: "waiting", waitingWhat: "Bash 실행 허용할까요? (npm test)", waitingSince: iso(4), lastPrompt: "결제 페이지 테스트 돌리고 실패 원인 정리해줘", lastEventAt: iso(4), startedAt: iso(190) },
    { sessionId: "demo-2", project: "blog-auto", cwd: "/work/blog-auto", state: "working", live: "working", waitingWhat: null, lastPrompt: "이번 주 글 3편 초안 만들어", lastEventAt: iso(1), startedAt: iso(80) },
    { sessionId: "demo-3", project: "invoice-tool", cwd: "/work/invoice-tool", state: "resting", live: "resting", waitingWhat: null, lastPrompt: "견적서 PDF 양식 고쳐줘", lastEventAt: iso(42), startedAt: iso(300) },
  ];
  const date = new Date(nowMs); const d = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const report = {
    date: d, generatedAt: new Date(nowMs).toISOString(),
    totals: { projects: 3, prompts: 9, edits: 7, runs: 6, waiting: 1 },
    decisions: [
      { project: "shop-site", kind: "승인 대기", text: "Bash 실행 허용할까요? (npm test)", since: iso(4) },
      { project: "invoice-tool", kind: "질문", text: "부가세 칸을 공급가액 아래에 둘까요, 합계 옆에 둘까요?", since: null },
    ],
    projects: [
      { project: "shop-site", title: "결제 페이지 테스트 실패 원인", sessions: 1, state: "waiting", span: "13:10~16:02", prompts: 4, promptSamples: ["결제 페이지 테스트 돌리고 실패 원인 정리해줘", "카드사 응답 코드별로 표 만들어"], edits: [{ name: "checkout.test.ts", count: 3 }, { name: "pay-client.ts", count: 2 }], editCount: 2, runs: ["테스트 전체 실행", "실패한 테스트만 다시 실행"], research: ["PG사 응답 코드 문서"], questions: [], reads: 12, subagents: 0, linesAdded: 84, linesRemoved: 19, lastText: "카드사 응답 코드 3종을 표로 정리했고, 타임아웃 재시도 로직을 고쳤습니다. 테스트 실행 허락이 필요합니다." },
      { project: "blog-auto", title: "이번 주 글 3편 초안", sessions: 1, state: "working", span: "15:20~16:05", prompts: 3, promptSamples: ["이번 주 글 3편 초안 만들어"], edits: [{ name: "draft-1.md", count: 1 }, { name: "draft-2.md", count: 1 }, { name: "draft-3.md", count: 1 }], editCount: 3, runs: ["글자 수 검사"], research: ["검색어 월간 조회수"], questions: [], reads: 5, subagents: 0, linesAdded: 210, linesRemoved: 0, lastText: "초안 2편 완료, 3편째 쓰는 중입니다." },
      { project: "invoice-tool", title: "견적서 PDF 양식", sessions: 1, state: "resting", span: "10:02~12:40", prompts: 2, promptSamples: ["견적서 PDF 양식 고쳐줘"], edits: [{ name: "invoice.html", count: 2 }, { name: "print.css", count: 1 }], editCount: 2, runs: ["PDF 미리보기 생성", "인쇄 여백 확인"], research: [], questions: ["부가세 칸을 공급가액 아래에 둘까요, 합계 옆에 둘까요?"], reads: 3, subagents: 0, linesAdded: 31, linesRemoved: 12, lastText: "양식을 고쳤습니다. 부가세 칸 위치만 정해 주시면 마무리합니다." },
    ],
  };
  return { sessions, report, demo: true };
}
