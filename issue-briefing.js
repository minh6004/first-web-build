// 이슈 브리핑 페이지 전용 스크립트. index.html의 script.js는 표지/메인 전환 등
// 이 페이지에 없는 요소를 전제로 하고 있어 그대로 가져다 쓸 수 없으므로,
// 필요한 만큼만(네비 토글 + 이 페이지 로직) 별도로 둔다.
import { initNavAuth } from "./nav-auth.js";

initNavAuth();

const navToggle = document.getElementById("navToggle");
const navList = document.getElementById("navList");

navToggle.addEventListener("click", () => {
  const isOpen = navList.classList.toggle("is-open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

// ---------------------------------------------------------------------------
// 오늘의 한줄평
// ---------------------------------------------------------------------------

// 오늘 발생한 이벤트를 종합한 한 줄 요약. 지금은 더미 텍스트지만, 나중에 실제
// 이벤트 데이터를 기반으로 자동 생성하도록 바뀔 때 이 함수 내부만 바꾸면 된다.
function getTodaysSummary() {
  return "오늘은 미국 기준금리가 0.25%p 내리면서 반도체·기술주는 강세, 금리에 민감한 리츠·부동산은 주춤한 흐름을 보였어요.";
}

document.getElementById("briefingSummaryText").textContent = getTodaysSummary();

// up/down/neutral(방향성이 뚜렷하지 않은 이벤트, 예: 자기주식 취득 공시)
// 세 가지를 표시하는 공용 헬퍼. 종합 신호/개별 이벤트 양쪽에서 같이 쓴다.
function directionArrow(direction) {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

function directionLabel(direction) {
  if (direction === "up") return "상승";
  if (direction === "down") return "하락";
  return "보합";
}

// ---------------------------------------------------------------------------
// ① 종합 신호 섹션
// ---------------------------------------------------------------------------

// 더미 데이터: 실제로는 오늘 수집된 이벤트를 섹터별로 묶어 상승/하락 요인
// 개수를 집계한 결과가 들어갈 자리. "섹터당 상승 2~3 / 하락 2~3"처럼 방향이
// 섞여 방향성 긴장이 큰 섹터를 우선 노출한다는 선정 기준을 보여주기 위해
// 혼조/하락 우세/상승 우세 사례를 하나씩 갖추었다.
const SIGNAL_SECTORS = [
  {
    id: "semiconductor",
    name: "반도체",
    events: [
      { name: "엔비디아 3분기 실적 발표 (매출 예상치 상회)", direction: "up", strength: "강함" },
      { name: "미국 반도체 수출규제 추가 검토", direction: "down", strength: "중간" },
      { name: "삼성전자 파운드리 대형 수주", direction: "up", strength: "중간" },
      { name: "중국 반도체 자급률 목표 상향", direction: "down", strength: "약함" },
      { name: "TSMC 첨단 공정 가동률 상승", direction: "up", strength: "약함" },
    ],
  },
  {
    id: "battery",
    name: "2차전지",
    events: [
      { name: "중국 배터리 업체 저가 공세 심화", direction: "down", strength: "강함" },
      { name: "유럽 전기차 보조금 축소 발표", direction: "down", strength: "중간" },
      { name: "국내 배터리 3사 미국 공장 증설 발표", direction: "up", strength: "중간" },
      { name: "리튬 가격 반등", direction: "down", strength: "약함" },
      { name: "완성차 업체 배터리 내재화 확대", direction: "down", strength: "약함" },
      { name: "국내 배터리 소재 기업 대규모 수주", direction: "up", strength: "약함" },
    ],
  },
  {
    id: "oil-chem",
    name: "정유·화학",
    events: [
      { name: "국제유가 WTI 급등 (중동 정정 불안)", direction: "up", strength: "강함" },
      { name: "국내 정유사 3분기 정제마진 개선", direction: "up", strength: "중간" },
      { name: "석유화학 수출 단가 상승", direction: "up", strength: "약함" },
      { name: "친환경 규제 강화로 설비 투자 부담 증가", direction: "down", strength: "중간" },
    ],
  },
];

// 선정 기준: 상승-하락 요인 수 차이가 2 이상 벌어지면 한쪽 우세, 그 미만이면
// (요인이 섞여 방향성 긴장이 있다는 뜻이므로) 혼조로 표시한다.
function computeSignalVerdict(upCount, downCount) {
  const diff = upCount - downCount;
  if (diff >= 2) return { label: "상승 우세", modifierClass: "up-dominant" };
  if (diff <= -2) return { label: "하락 우세", modifierClass: "down-dominant" };
  return { label: "혼조", modifierClass: "mixed" };
}

function renderSignalCard(sector) {
  const upCount = sector.events.filter((e) => e.direction === "up").length;
  const downCount = sector.events.filter((e) => e.direction === "down").length;
  const verdict = computeSignalVerdict(upCount, downCount);
  const total = upCount + downCount;
  const upPct = total ? Math.round((upCount / total) * 100) : 50;
  const downPct = 100 - upPct;

  const eventsHtml = sector.events
    .map(
      (e) => `
      <li class="signal-event-item">
        <span class="signal-event-name">${e.name}</span>
        <span class="signal-event-arrow ${e.direction}">
          <span class="visually-hidden">${directionLabel(e.direction)}</span>
          <span aria-hidden="true">${directionArrow(e.direction)}</span>
        </span>
        <span class="signal-event-strength">${e.strength}</span>
      </li>`
    )
    .join("");

  const card = document.createElement("article");
  card.className = "signal-card card";
  card.innerHTML = `
    <div class="signal-card-head">
      <h3 class="signal-sector-name">${sector.name}</h3>
      <span class="badge signal-badge ${verdict.modifierClass}">${verdict.label}</span>
    </div>
    <p class="signal-count-line">상승 요인 ${upCount} · 하락 요인 ${downCount}</p>
    <div class="signal-balance-bar" role="img" aria-label="상승 요인 비중 ${upPct}%, 하락 요인 비중 ${downPct}%">
      <div class="signal-balance-up" style="width:${upPct}%"></div>
      <div class="signal-balance-down" style="width:${downPct}%"></div>
    </div>
    <ul class="signal-event-list">${eventsHtml}</ul>
    <p class="signal-disclaimer">이 신호는 오늘 발생한 이벤트의 방향성과 강도를 단순 합산한 참고 지표이며, 투자 조언이 아닙니다.</p>
  `;
  return card;
}

const signalGrid = document.getElementById("signalGrid");
SIGNAL_SECTORS.forEach((sector) => signalGrid.appendChild(renderSignalCard(sector)));

// ---------------------------------------------------------------------------
// ② 개별 이벤트 리스트
// ---------------------------------------------------------------------------

// 더미 데이터. "어제" 그룹 4건은 (예전 메인 화면의 '오늘의 빅 이벤트'
// 섹션과 동일한 사건들이며, 지금은 index.html에 주석 처리되어 있다.
const EVENTS = [
  {
    id: "evt-oil-margin",
    dateGroup: "오늘",
    dateLabel: "2026.09.19",
    org: "국내 정유사",
    decision: "3분기 정제마진 개선 발표",
    chips: [
      { sector: "정유", direction: "up" },
      { sector: "화학", direction: "up" },
    ],
    cause: "국내 정유사, 3분기 정제마진 개선 발표",
    mechanism:
      "정제마진이 커지면 정유사가 원유를 제품으로 바꿔 파는 과정에서 남기는 이윤이 늘어나 정유·화학 업종 실적 기대가 함께 올라간다.",
    sectors: [
      { name: "정유", direction: "up" },
      { name: "화학", direction: "up" },
    ],
    explain:
      "정제마진 개선은 정유사의 핵심 수익성 지표라 실적 발표 전에도 주가에 선반영되는 경우가 많고, 원료를 공급받는 화학 계열사에도 우호적인 신호로 해석돼요.",
    counterpoint:
      "정제마진은 국제 유가와 환율에 따라 분기마다 변동성이 커서, 한 분기 개선만으로 추세적 상승을 단정하기는 이르다는 시각도 있어요.",
  },
  {
    id: "evt-battery-china",
    dateGroup: "오늘",
    dateLabel: "2026.09.19",
    org: "중국 배터리 업체",
    decision: "국내 시장 저가 공세 심화",
    chips: [
      { sector: "2차전지", direction: "down" },
      { sector: "배터리소재", direction: "down" },
    ],
    cause: "중국 배터리 업체, 국내 시장 저가 공세 심화",
    mechanism:
      "저가 경쟁이 심해지면 국내 배터리·소재 기업들이 가격을 따라 낮추거나 점유율을 잃게 되어 수익성에 부담이 된다.",
    sectors: [
      { name: "2차전지", direction: "down" },
      { name: "배터리소재", direction: "down" },
    ],
    explain:
      "중국 업체는 규모의 경제와 정부 보조금을 앞세워 원가 경쟁력이 높아, 국내 업체 입장에서는 단가 방어가 쉽지 않은 구조예요.",
    counterpoint:
      "반대로 저가 공세가 계속되면 품질·안전성 이슈가 불거질 수 있고, 이 경우 오히려 프리미엄을 내세운 국내 업체로 수요가 옮겨갈 수도 있어요.",
  },
  {
    id: "evt-tsmc",
    dateGroup: "오늘",
    dateLabel: "2026.09.19",
    org: "TSMC",
    decision: "첨단 공정 가동률 상승 발표",
    chips: [
      { sector: "반도체", direction: "up" },
      { sector: "파운드리", direction: "up" },
    ],
    cause: "TSMC, 첨단 공정 가동률 상승 발표",
    mechanism:
      "파운드리 최선단 공정 가동률이 오르면 반도체 수요 회복 신호로 읽혀 관련 장비·소재·팹리스 업종 전반의 투자 심리가 개선된다.",
    sectors: [
      { name: "반도체", direction: "up" },
      { name: "파운드리", direction: "up" },
    ],
    explain:
      "TSMC의 가동률은 전방산업(AI·모바일 등) 수요를 가늠하는 선행지표로 자주 쓰여서, 국내 장비·소재 업체 주가에도 곧잘 영향을 줘요.",
    counterpoint:
      "가동률 상승이 특정 대형 고객사 물량에 쏠린 결과라면, 업황 전반의 회복이 아니라 일시적 쏠림일 수 있다는 반론도 있어요.",
  },
  {
    id: "evt-fed",
    dateGroup: "어제",
    dateLabel: "2026.09.18",
    org: "미국 연방준비제도(Fed)",
    decision: "기준금리 0.25%p 인상 결정",
    chips: [
      { sector: "금융", direction: "up" },
      { sector: "부동산", direction: "down" },
      { sector: "성장주", direction: "down" },
    ],
    cause: "미국 연방준비제도(Fed), 기준금리 0.25%p 인상 결정",
    mechanism:
      "금리가 오르면 대출 이자 부담이 커져서 빚을 많이 낸 성장주·부동산 관련 기업엔 부담이지만, 은행은 예대마진이 개선돼 반사이익을 볼 수 있다.",
    sectors: [
      { name: "금융", direction: "up" },
      { name: "부동산", direction: "down" },
      { name: "성장주", direction: "down" },
    ],
    explain:
      "금리가 오르면 대출 이자 부담이 커져서 특히 빚을 많이 낸 성장주 기업들의 주가가 부담을 받을 수 있어요.",
    counterpoint:
      "이미 시장이 예상했던 수준의 인상이라면 오히려 불확실성이 해소돼서 단기적으로는 반등하는 경우도 많아요.",
  },
  {
    id: "evt-bok",
    dateGroup: "어제",
    dateLabel: "2026.09.18",
    org: "한국은행",
    decision: "기준금리 동결 결정",
    chips: [
      { sector: "은행주", direction: "up" },
      { sector: "성장주", direction: "up" },
    ],
    cause: "한국은행, 기준금리 동결 결정",
    mechanism:
      "금리를 유지하면 기업과 가계의 이자 부담이 당장 늘지 않아서 소비와 투자 심리가 안정되고, 관련주 전반에 우호적으로 작용한다.",
    sectors: [
      { name: "은행주", direction: "up" },
      { name: "성장주", direction: "up" },
    ],
    explain:
      "금리를 유지하면 기업과 가계의 이자 부담이 당장 늘지 않아서 소비와 투자 심리가 안정될 수 있어요.",
    counterpoint: "물가가 계속 오르는 상황에서 금리를 동결하면 나중에 더 큰 폭으로 올려야 할 수도 있어요.",
  },
  {
    id: "evt-nvidia",
    dateGroup: "어제",
    dateLabel: "2026.09.18",
    org: "엔비디아",
    decision: "3분기 실적 발표 (매출 시장 예상치 상회)",
    chips: [
      { sector: "반도체", direction: "up" },
      { sector: "AI", direction: "up" },
      { sector: "메모리", direction: "up" },
    ],
    cause: "엔비디아, 3분기 실적 발표 (매출 시장 예상치 상회)",
    mechanism:
      "AI 반도체 수요가 예상보다 강했다는 뜻이라, 관련 부품·장비를 공급하는 국내 반도체·메모리 기업들도 수혜를 볼 가능성이 커진다.",
    sectors: [
      { name: "반도체", direction: "up" },
      { name: "AI", direction: "up" },
      { name: "메모리", direction: "up" },
    ],
    explain:
      "AI 수요가 예상보다 강하다는 뜻이라 관련 부품을 공급하는 국내 반도체 기업들도 수혜를 볼 가능성이 있어요.",
    counterpoint:
      '실적이 좋아도 이미 주가에 기대감이 많이 반영되어 있었다면 "발표 후 오히려 하락"하는 경우도 흔해요.',
  },
  {
    id: "evt-pboc",
    dateGroup: "어제",
    dateLabel: "2026.09.18",
    org: "중국 인민은행",
    decision: "지급준비율 0.5%p 인하 결정",
    chips: [
      { sector: "화장품", direction: "up" },
      { sector: "여행", direction: "up" },
      { sector: "중국소비주", direction: "up" },
    ],
    cause: "중국 인민은행, 지급준비율 0.5%p 인하 결정",
    mechanism:
      "지급준비율을 내리면 시중에 돈이 더 풀려서 중국 내 소비가 살아날 가능성이 있고, 중국 소비에 민감한 국내 기업들이 영향을 받는다.",
    sectors: [
      { name: "화장품", direction: "up" },
      { name: "여행", direction: "up" },
      { name: "중국소비주", direction: "up" },
    ],
    explain:
      "지급준비율을 내리면 시중에 돈이 더 풀려서 중국 내 소비가 살아날 가능성이 있고, 중국 소비에 민감한 국내 기업들이 영향을 받아요.",
    counterpoint:
      "중국 정부가 돈을 풀어야 할 만큼 경기가 안 좋다는 신호로 해석되면 오히려 우려로 이어질 수도 있어요.",
  },
];

// 압축 행(renderEventRow)과 인과관계 다이어그램(renderEventDiagram)을 별도
// 함수로 분리해 둔다 -- 이벤트가 수십 건으로 늘어나도 목록 렌더링과 상세
// 렌더링을 독립적으로 손볼 수 있고, 나중에 데스크톱 마스터-디테일(좌: 목록,
// 우: 다이어그램 패널) 레이아웃이나 모바일 별도 상세 페이지로 확장할 때도
// 이 두 함수만 각자 다른 위치에 붙이면 된다.
function renderEventRow(event) {
  const chipsHtml = event.chips
    .map((c) => `<span class="briefing-chip ${c.direction}">${c.sector}${directionArrow(c.direction)}</span>`)
    .join("");

  const button = document.createElement("button");
  button.type = "button";
  button.className = "briefing-event-toggle";
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", `${event.id}-detail`);
  button.innerHTML = `
    <span class="briefing-event-line">${event.org} ${event.decision}</span>
    <span class="briefing-event-chips">${chipsHtml}</span>
  `;
  return button;
}

function renderEventDiagram(event) {
  const branchesHtml = event.sectors
    .map(
      (s) => `
      <div class="briefing-diagram-node briefing-diagram-node--sector ${s.direction}">
        <span>${s.name}</span>
        <span class="briefing-diagram-arrow-inline" aria-hidden="true">${directionArrow(s.direction)}</span>
      </div>`
    )
    .join("");

  const detail = document.createElement("div");
  detail.className = "briefing-event-detail";
  detail.id = `${event.id}-detail`;
  detail.inert = true;
  detail.innerHTML = `
    <div class="briefing-diagram">
      <div class="briefing-diagram-node briefing-diagram-node--cause">
        <span class="briefing-diagram-label">기관 · 결정</span>
        <p>${event.cause}</p>
      </div>
      <span class="briefing-diagram-arrow" aria-hidden="true">→</span>
      <div class="briefing-diagram-node briefing-diagram-node--mechanism">
        <span class="briefing-diagram-label">메커니즘</span>
        <p>${event.mechanism}</p>
      </div>
      <span class="briefing-diagram-arrow" aria-hidden="true">→</span>
      <div class="briefing-diagram-branches">${branchesHtml}</div>
    </div>
    <div class="briefing-explain">
      <p class="briefing-explain-label">왜 이런 인과관계인가요?</p>
      <p>${event.explain}</p>
    </div>
    <div class="briefing-counterpoint">
      <p class="briefing-explain-label">반대로 생각하면?</p>
      <p>${event.counterpoint}</p>
    </div>
  `;
  return detail;
}

// 한 번에 하나의 행만 펼쳐지도록 관리하는 아코디언 상태.
let openDetailId = null;

function closeOpenEvent() {
  if (!openDetailId) return;
  const openButton = document.querySelector(`.briefing-event-toggle[aria-controls="${openDetailId}"]`);
  const openDetail = document.getElementById(openDetailId);
  if (openButton) openButton.setAttribute("aria-expanded", "false");
  if (openDetail) {
    openDetail.classList.remove("is-open");
    openDetail.inert = true;
  }
  openDetailId = null;
}

function buildEventList(events) {
  const container = document.getElementById("briefingList");

  const groups = [];
  events.forEach((event) => {
    let group = groups.find((g) => g.dateGroup === event.dateGroup);
    if (!group) {
      group = { dateGroup: event.dateGroup, dateLabel: event.dateLabel, events: [] };
      groups.push(group);
    }
    group.events.push(event);
  });

  groups.forEach((group) => {
    const groupEl = document.createElement("div");
    groupEl.className = "briefing-date-group";

    const heading = document.createElement("h3");
    heading.className = "briefing-date-heading";
    heading.textContent = `${group.dateGroup} · ${group.dateLabel}`;
    groupEl.appendChild(heading);

    group.events.forEach((event) => {
      const wrap = document.createElement("div");
      wrap.className = "briefing-event card";

      const row = renderEventRow(event);
      const detail = renderEventDiagram(event);

      row.addEventListener("click", () => {
        const wasOpen = row.getAttribute("aria-expanded") === "true";
        closeOpenEvent(); // 아코디언: 열려 있던 다른 행을 먼저 닫는다
        if (wasOpen) return; // 이미 열려 있던 행이었다면 닫는 것으로 끝

        row.setAttribute("aria-expanded", "true");
        detail.classList.add("is-open");
        detail.inert = false;
        openDetailId = detail.id;
      });

      wrap.appendChild(row);
      wrap.appendChild(detail);
      groupEl.appendChild(wrap);
    });

    container.appendChild(groupEl);
  });
}

// ---------------------------------------------------------------------------
// 실제 데이터 연동 (DART 수집 파이프라인, scripts/dart/collect-events.mjs가
// data/latest.json을 만들어 둔다)
// ---------------------------------------------------------------------------

// DART 파이프라인이 만든 이벤트를 이 페이지의 렌더링 함수가 기대하는 모양
// (org/decision/chips/cause/mechanism/sectors/explain/counterpoint)으로
// 바꾼다. impact.affected_sectors가 이미 {sector, direction} 형태라
// chips/sectors 둘 다 그대로 재사용한다.
// event_datetime을 항상 KST(UTC+9) 달력 기준으로 "YYYY.MM.DD"로 바꾼다.
// Date의 getFullYear()/getMonth()/getDate()는 "보는 사람 브라우저의 로컬
// 시간대"를 쓰기 때문에, 그걸 그대로 썼더니 실제로 문제가 있었다: Fed
// 이벤트의 UTC 타임스탬프(18:00Z)가 KST에서는 다음 날 새벽(03:00)으로
// 넘어가는데, 로컬 getter는 브라우저 시간대에 따라 하루가 밀리거나 안
// 밀리거나 제각각으로 나왔다. UTC 타임스탬프에 9시간을 더한 뒤 UTC
// getter로 읽으면 어떤 브라우저에서 봐도 항상 같은 KST 날짜가 나온다.
function toKstDateLabel(date) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(kst.getUTCDate()).padStart(2, "0");
  return `${y}.${m}.${d}`;
}

function mapDartEventToBriefingEvent(dartEvent) {
  const dateLabel = toKstDateLabel(new Date(dartEvent.event_datetime));
  const todayLabel = toKstDateLabel(new Date());
  const dateGroup = dateLabel === todayLabel ? "오늘" : dateLabel;

  return {
    id: dartEvent.id,
    dateGroup,
    dateLabel,
    org: dartEvent.subject.name,
    decision: dartEvent.content.headline.replace(`${dartEvent.subject.name}, `, ""),
    chips: dartEvent.impact.affected_sectors,
    cause: dartEvent.content.headline,
    mechanism: dartEvent.content.horizon.short_term,
    sectors: dartEvent.impact.affected_sectors.map((s) => ({ name: s.sector, direction: s.direction })),
    // "설명"/"반대 시각" 슬롯에 잠정적으로 단기/중장기 해설을 매핑해뒀다 --
    // 실제 "반대 시각" 전용 문구가 생기면 교체할 자리.
    explain: dartEvent.content.horizon.short_term,
    counterpoint: dartEvent.content.horizon.long_term,
  };
}

// data/latest.json이 있으면(수집 스크립트를 이미 돌렸으면) 그 데이터를
// 쓰고, 없거나 비어 있거나 형식이 안 맞으면 더미 데이터(EVENTS)로
// 되돌아간다 -- 수집 스크립트를 아직 안 돌린 상태에서도 페이지가 깨지지
// 않아야 하기 때문.
async function loadEvents() {
  try {
    const response = await fetch("./data/latest.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.events) || payload.events.length === 0) {
      throw new Error("이벤트가 비어 있음");
    }
    return payload.events.map(mapDartEventToBriefingEvent);
  } catch (error) {
    console.warn("실제 이벤트 데이터를 불러오지 못해 더미 데이터로 표시합니다:", error.message);
    return EVENTS;
  }
}

loadEvents().then(buildEventList);
