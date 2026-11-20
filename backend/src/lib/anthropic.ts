import Anthropic from '@anthropic-ai/sdk';

/**
 * Anthropic 클라이언트.
 *
 * 키가 없으면 만들지 않는다 — 시세 리포트 기능만 못 쓰고 나머지 서버는 그대로 뜬다.
 * 조직 단위로 만든 키는 워크스페이스를 알려줘야 해서, 있으면 헤더로 붙인다.
 */
let client: Anthropic | null | undefined;

export function anthropic(): Anthropic | null {
  if (client !== undefined) return client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    client = null;
    return null;
  }

  const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID;
  client = new Anthropic({
    apiKey,
    ...(workspaceId ? { defaultHeaders: { 'anthropic-workspace-id': workspaceId } } : {}),
  });
  return client;
}

export const aiReady = () => Boolean(process.env.ANTHROPIC_API_KEY);

/**
 * 표를 읽는 쪽.
 *
 * 숫자 하나 틀리면 그대로 공개되는 자리지만, 8개 양식 490칸을 Haiku 로 읽혀
 * 전부 맞는 걸 확인했다 — Opus·Sonnet 과 동률인데 35배 싸다.
 */
export const EXTRACT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-5-5';

/**
 * 글을 쓰는 쪽.
 *
 * 한동안 Sonnet 을 썼다. Haiku 가 "존댓말로 쓴다"는 지시를 어기고 반말로 썼기 때문인데,
 * 글 구조를 blocks 로 바꾸면서 프롬프트를 다시 쓴 뒤로는 그러지 않는다.
 * 같은 시세표로 견줘 보니 숫자도 전부 맞고 글맛 차이도 크지 않은데 **14배 싸다**
 * (건당 55원 → 4원). 글맛을 더 보고 싶으면 ANTHROPIC_WRITE_MODEL 로 올리면 된다.
 */
export const WRITE_MODEL = process.env.ANTHROPIC_WRITE_MODEL ?? 'claude-haiku-5-5';

/**
 * 수집한 소식의 제목을 옮기는 쪽 — **가장 싼 모델로 고정한다.**
 *
 * 어떤 소식인지 알아보려는 것뿐이라 품질을 살 이유가 없다. 표 읽기(EXTRACT_MODEL)를
 * 따라가게 두면 나중에 정확도 때문에 그쪽을 올렸을 때 번역까지 같이 비싸진다.
 */
export const TRANSLATE_MODEL = process.env.ANTHROPIC_TRANSLATE_MODEL ?? 'claude-haiku-5-5';

/**
 * 1M 토큰당 달러. 모델을 바꾸면 여기도 고쳐야 로그의 비용이 맞는다.
 * 출처: platform.claude.com 요금표 (2026-11 기준)
 */
const PRICE: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
}

/**
 * 한 번 호출에 든 돈을 로그로 남긴다.
 *
 * 시세 글은 매주 쌓이는 작업이라 건당 비용을 눈으로 보고 있어야
 * 모델을 바꿀지 말지 판단할 수 있다.
 */
export function logUsage(app: { log: { info: (data: object, msg: string) => void } }, label: string, model: string, usage: Usage) {
  const price = PRICE[model];
  const input = usage.input_tokens + (usage.cache_read_input_tokens ?? 0);
  const cost = price ? (input * price.input + usage.output_tokens * price.output) / 1_000_000 : null;
  app.log.info(
    { label, model, input, output: usage.output_tokens, usd: cost?.toFixed(4) ?? '요금표 없음' },
    `AI 사용량 — ${label}`,
  );
  return cost;
}
