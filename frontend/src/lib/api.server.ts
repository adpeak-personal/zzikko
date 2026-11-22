import 'server-only';
import { cookies } from 'next/headers';
import { ApiError, toApiError } from './api';

/**
 * 백엔드(Fastify) 호출 — 서버 컴포넌트 쪽.
 *
 * 서버에서는 절대주소가 필요하고, 로그인 쿠키를 직접 실어 보내야 한다.
 *
 * `server-only` 를 import 해 두었으므로 클라이언트 컴포넌트가 실수로 가져가면
 * 빌드 단계에서 바로 걸린다 (`next/headers` 의 알아보기 힘든 에러 대신).
 */
const SERVER_API = process.env.API_URL ?? 'http://127.0.0.1:4080';

/** 글이 바로 보여야 하므로 캐시하지 않는다 */
export async function apiGet<T>(path: string): Promise<T> {
  const cookieHeader = (await cookies()).toString();
  const res = await fetch(`${SERVER_API}/api/v1${path}`, {
    cache: 'no-store',
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

/** 404 는 null 로 — 페이지에서 notFound() 로 처리한다 */
export async function apiGetOrNull<T>(path: string): Promise<T | null> {
  try {
    return await apiGet<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * 로그인 쿠키 없이 부른다.
 *
 * `generateStaticParams` 는 **요청 없이 빌드 때 돌기 때문에** `cookies()` 를 부르면
 * 바로 터진다. 거기서는 이 함수를 쓴다. 공개 목록만 가져오는 용도라 쿠키가 필요 없다.
 *
 * ⚠️ `revalidate` 를 주면 그 초만큼 캐시한다. **`cache: 'no-store'` 와 같이 주면
 * 둘 다 무시되므로**(Next 규칙) 하나만 건다. 사이트맵처럼 매 요청마다 DB 를
 * 훑을 이유가 없는 곳에서 쓴다.
 */
export async function apiGetPublic<T>(path: string, revalidate?: number): Promise<T | null> {
  try {
    const res = await fetch(
      `${SERVER_API}/api/v1${path}`,
      revalidate === undefined ? { cache: 'no-store' } : { next: { revalidate } },
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // 빌드 중 백엔드가 안 떠 있을 수도 있다 — 그땐 주소를 안 만들고 넘어간다
    return null;
  }
}
