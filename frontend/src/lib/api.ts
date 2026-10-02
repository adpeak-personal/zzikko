/**
 * 백엔드(Fastify) 호출 — 브라우저 쪽.
 *
 * 상대경로로 부른다. next.config.ts 의 rewrite 가 백엔드로 넘겨주므로 같은 출처가 되어
 * CORS 도, 쿠키 문제도 없다.
 *
 * ⚠️ 이 파일에는 서버 전용 API(`next/headers` 등)를 넣지 말 것.
 * 클라이언트 컴포넌트가 여기서 `apiFetch` 를 가져가므로, 서버 전용 코드가 섞이면 빌드가 깨진다.
 * 서버 컴포넌트에서 쓸 함수는 `api.server.ts` 에 둔다.
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function toApiError(res: Response) {
  const body = await res.json().catch(() => null);
  return new ApiError(res.status, body?.message ?? '요청을 처리하지 못했습니다.', body?.issues);
}

/** 브라우저 전용 — 로그인 쿠키가 자동으로 실린다 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

/** 쿼리스트링 만들기 — 빈 값은 빼고 붙인다 */
export function query(params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
