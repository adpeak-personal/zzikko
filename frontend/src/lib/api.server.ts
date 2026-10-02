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
