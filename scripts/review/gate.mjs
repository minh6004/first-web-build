// AI 검수 게이트 -- 2군(비공식) 소스(GDELT/네이버뉴스)가 만든 카드가 실제
// 증거로 뒷받침되는지 Haiku급 모델로 하루치를 한 번에(배치) 검수한다.
//
// 격리 원칙(사용자 명시 요구): 이 프롬프트에는 카드를 만든 스크립트의
// 추론/로직/컨텍스트를 절대 넘기지 않는다. 오직 (1) 원본 증거(헤드라인/
// 스니펫/매체/corroboration_count, GDELT는 언급량·톤 수치)와 (2) 생성된
// 카드 내용(headline/chips/단기·중장기 해설)만 준다 -- 생성 스크립트와
// 완전히 분리된 별도 프롬프트.
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const REVIEW_MODEL = "claude-haiku-4-5-20251001";

function getApiKey() {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되어 있지 않습니다.");
  return key;
}

// 네트워크 오류나 429/5xx(일시적일 수 있는 오류)는 짧게 재시도한다. 실제로
// 이 배치 호출 자체가 "fetch failed"로 실패해서 정상적인 2군 후보가 전부
// 안전 기본값(reject)으로 처리된 적이 있었다 -- 검수 게이트 호출이 아예
// 안 되는 것과 검수 결과 자체가 나쁜 것은 다른 상황이라, 호출 실패는
// 재시도로 먼저 구제한다(401/400 같은 요청 자체의 문제는 재시도해도
// 의미가 없어서 즉시 실패 처리).
const MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 3000;

async function callAnthropicWithRetry(body, attempt = 0) {
  const retryIfPossible = async (reasonForLog) => {
    if (attempt >= MAX_RETRIES) return null;
    const backoffMs = BASE_BACKOFF_MS * 2 ** attempt;
    console.warn(`  ⚠ AI 검수 게이트 ${reasonForLog} -- ${Math.round(backoffMs / 1000)}초 대기 후 재시도(${attempt + 1}/${MAX_RETRIES})`);
    await new Promise((resolve) => setTimeout(resolve, backoffMs));
    return callAnthropicWithRetry(body, attempt + 1);
  };

  let response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: { "x-api-key": getApiKey(), "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const retried = await retryIfPossible(`네트워크 오류(${error.message})`);
    if (retried) return retried;
    throw new Error(`AI 검수 게이트 API 요청 실패(네트워크 오류, ${MAX_RETRIES}회 재시도 후에도 실패): ${error.message}`);
  }

  if (response.status === 429 || response.status >= 500) {
    const retried = await retryIfPossible(`요청 실패(status ${response.status})`);
    if (retried) return retried;
  }
  return response;
}

function formatEvidenceBlock({ id, evidence, card }) {
  const lines = [`[증거 ${id}] (소스: ${evidence.source})`];

  if (evidence.source === "naver") {
    lines.push(`교차확인 매체 수: ${evidence.corroboration_count}`);
    lines.push("근거 헤드라인(같은 이야기로 묶인 기사들):");
    evidence.headlines.forEach((h, i) => lines.push(`  - "${h}" (${evidence.media_domains[i] ?? "매체 미상"})`));
    lines.push("스니펫:");
    evidence.snippets.forEach((s) => lines.push(`  - "${s}"`));
  } else if (evidence.source === "gdelt") {
    lines.push(`오늘 언급량: ${evidence.volume_today_pct}% (최근 7일 평균 ${evidence.volume_baseline_pct}%, ${evidence.spike_ratio}배)`);
    lines.push(`평균 톤(양수=긍정, 음수=부정): ${evidence.avg_tone}`);
    lines.push(`교차확인 매체 수: ${evidence.media_domains.length}`);
    lines.push("샘플 헤드라인:");
    evidence.sample_headlines.forEach((h) => lines.push(`  - "${h}"`));
  }

  lines.push(`[생성된 카드 ${id}]`);
  lines.push(`헤드라인: "${card.headline}"`);
  lines.push(`칩: ${card.chips.join(", ")}`);
  lines.push(`단기 해설: "${card.horizon.short_term}"`);
  lines.push(`중장기 해설: "${card.horizon.long_term}"`);
  return lines.join("\n");
}

function buildPrompt(candidates) {
  const blocks = candidates.map(formatEvidenceBlock).join("\n\n");
  return `당신은 자동 생성된 뉴스 화제성 카드를 검수하는 게이트입니다. 아래 각 후보에 대해 "원본 증거"만 보고 "생성된 카드"가 타당한지 판단하세요. 이 카드가 어떻게 만들어졌는지에 대한 정보는 주어지지 않으며, 오직 제시된 증거만으로 판단해야 합니다.

판단 기준:
1. 카드의 모든 주장이 제공된 헤드라인/스니펫/수치에서 실제로 뒷받침되는가.
2. 방향(상승/하락)·강도 라벨이 증거 대비 과장되지 않았는가.
3. 여러 매체가 교차 확인한 내용인지, 단일 출처의 추측성 보도인지.
4. 확정적으로 단정하지 않고 참고용 해석 톤을 유지하는가.

${blocks}

위 후보 각각에 대해 approve 또는 reject로 판단하고, 다음 JSON 배열 형식으로만 응답하세요. 다른 설명은 붙이지 마세요:
[{"id": "...", "verdict": "approve" | "reject", "reason": "..."}]`;
}

function extractJsonArray(text) {
  const cleaned = text
    .trim()
    .replace(/^```(json)?/i, "")
    .replace(/```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

/**
 * @param {{id:string, evidence:object, card:object}[]} candidates
 * @returns {Promise<Map<string, {verdict:"approve"|"reject", reason:string}>>}
 */
export async function reviewCandidates(candidates) {
  if (candidates.length === 0) return new Map();

  const response = await callAnthropicWithRetry({
    model: REVIEW_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: buildPrompt(candidates) }],
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`AI 검수 게이트 API 요청 실패 (status ${response.status}): ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";

  let results;
  try {
    results = extractJsonArray(text);
  } catch (error) {
    // 검수 응답을 파싱하지 못하면 "불확실하니 통과"가 아니라 안전하게 전부
    // reject 처리한다 -- tier:2 이벤트는 검수를 통과해야만 발행되는데,
    // 검수 자체가 실패했다면 발행하지 않는 쪽이 안전하다.
    console.warn(`  ⚠ AI 검수 응답 파싱 실패, 이번 배치는 전부 반려 처리: ${error.message}`);
    return new Map(candidates.map((c) => [c.id, { verdict: "reject", reason: "검수 응답 파싱 실패(안전 기본값)" }]));
  }

  const verdictMap = new Map();
  for (const result of results) {
    if (result?.id && (result.verdict === "approve" || result.verdict === "reject")) {
      verdictMap.set(result.id, { verdict: result.verdict, reason: result.reason ?? "" });
    }
  }
  // 모델이 실수로 빠뜨린 후보도 안전하게 reject 처리.
  for (const candidate of candidates) {
    if (!verdictMap.has(candidate.id)) {
      verdictMap.set(candidate.id, { verdict: "reject", reason: "검수 응답에 누락됨(안전 기본값)" });
    }
  }
  return verdictMap;
}
