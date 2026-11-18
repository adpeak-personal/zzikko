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

/** 표를 읽는 쪽 — 숫자 하나 틀리면 그대로 공개되므로 좋은 모델을 쓴다 */
export const EXTRACT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5';

/** 글을 쓰는 쪽 */
export const WRITE_MODEL = process.env.ANTHROPIC_WRITE_MODEL ?? 'claude-opus-5-5';

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
