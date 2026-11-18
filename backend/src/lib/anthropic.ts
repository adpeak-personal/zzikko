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
