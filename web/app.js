// 화면 한 장. 5초마다 /api/state 를 읽어 그린다. 저장된 상태만 보이고 꾸며 내지 않는다.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const STATE_LABEL = { working: "일하는 중", waiting: "내 답을 기다림", resting: "쉬는 중", gone: "퇴근" };
const hhmm = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
let lastMarkdown = "";

function seat(s) {
  const st = s.live ?? s.state ?? "resting";
  const what = st === "waiting" ? (s.waitingWhat || "승인 또는 답이 필요합니다") : st === "working" ? (s.lastPrompt ? "요청 처리 중" : "일하는 중") : STATE_LABEL[st];
  return `<div class="seat ${esc(st)}" title="${esc(s.cwd ?? "")}">
    <img class="mark" alt="" src="/img/otter-${st === "waiting" ? "waiting" : st === "working" ? "working" : "hero"}.png" width="56" height="56">
    <b>${esc(s.project)}</b>
    <span class="st"><i></i><span>${esc(what)}${st === "waiting" && s.waitingSince ? ` · ${hhmm(s.waitingSince)}부터` : ""}</span></span>
    ${s.lastPrompt ? `<span class="prompt">마지막 요청: ${esc(s.lastPrompt)}</span>` : ""}
  </div>`;
}

function project(p) {
  const row = (k, v) => v ? `<div class="row"><b>${k}</b><span>${v}</span></div>` : "";
  return `<article class="card">
    <h3>${esc(p.project)}${p.title ? `<small>${esc(p.title)}</small>` : ""}${p.span ? `<small>${esc(p.span)}</small>` : ""}<small>${STATE_LABEL[p.state] ?? ""}</small></h3>
    ${row("요청", p.promptSamples?.length ? esc(p.promptSamples.join(" / ")) + (p.prompts > p.promptSamples.length ? ` <em>외 ${p.prompts - p.promptSamples.length}건</em>` : "") : "")}
    ${row("고친 파일", p.edits?.length ? esc(p.edits.map((e) => e.count > 1 ? `${e.name}×${e.count}` : e.name).join(", ")) + (p.linesAdded || p.linesRemoved ? ` <em>(+${p.linesAdded} / -${p.linesRemoved}줄)</em>` : "") : "")}
    ${row("실행", p.runs?.length ? esc(p.runs.join(" / ")) : "")}
    ${row("조사", p.research?.length ? esc(p.research.join(" / ")) : "")}
    ${row("물어본 것", p.questions?.length ? esc(p.questions.join(" / ")) : "")}
    ${p.lastText ? `<p class="last">${esc(p.lastText)}</p>` : ""}
  </article>`;
}

function render(st) {
  const r = st.report; const sessions = st.sessions ?? [];
  $("#demo-badge").hidden = !st.demo;
  $("#title").textContent = `${r.date} ${r.carriedOver ? "어제 AI가 한 일 (새벽이라 어제 보고서)" : "오늘 AI가 한 일"}`;
  $("#lede").innerHTML = `프로젝트 <b>${r.totals.projects}개</b>에서 요청 <b>${r.totals.prompts}건</b>, 고친 파일 <b>${r.totals.edits}개</b>, 실행 <b>${r.totals.runs}건</b>.${r.totals.waiting ? ` 지금 <b style="color:var(--bad)">${r.totals.waiting}건</b>이 내 답을 기다립니다.` : " 기다리는 것은 없습니다."}`;
  $("#stamp").textContent = `갱신 ${hhmm(r.generatedAt)}`;
  const live = sessions.filter((s) => (s.live ?? s.state) !== "gone");
  $("#seats").innerHTML = live.length ? live.map(seat).join("") : '<p class="empty empty-otter"><img src="/img/otter-hero.png" alt=""><span>열려 있는 Claude 세션이 없습니다. 일을 시키면 여기 앉습니다.</span></p>';
  $("#work-count").textContent = `${r.projects.length}개 프로젝트`;
  $("#work").innerHTML = r.projects.length ? r.projects.map(project).join("") : '<p class="empty">오늘 기록된 작업이 없습니다.</p>';
  $("#decide-count").textContent = `${r.decisions.length}건`;
  $("#decide").innerHTML = r.decisions.length ? r.decisions.map((d) => `<li class="${d.kind === "질문" ? "q" : ""}"><b>${esc(d.kind)} · ${esc(d.project)}${d.since ? ` · ${hhmm(d.since)}부터` : ""}</b>${esc(d.text)}</li>`).join("") : '<p class="empty">지금 결정할 것이 없습니다.</p>';
}

async function tick() {
  try {
    const st = await (await fetch("/api/state", { cache: "no-store" })).json();
    render(st);
    lastMarkdown = await (await fetch("/api/report?format=md", { cache: "no-store" })).text();
  } catch (e) {
    $("#lede").textContent = "서버에 연결할 수 없습니다. node scripts/start.mjs --open 으로 다시 켜 주세요.";
  }
}
$("#copy").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(lastMarkdown); $("#copy").textContent = "복사됨"; setTimeout(() => { $("#copy").textContent = "보고서 복사 (마크다운)"; }, 1500); }
  catch { window.open("/api/report?format=md", "_blank"); }
});
tick(); setInterval(tick, 5000);
