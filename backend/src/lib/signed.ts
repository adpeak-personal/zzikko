import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * 짧게 쓰고 버리는 서명 토큰 — 휴대폰 인증 완료 표시, 카카오 로그인 중간 상태.
 *
 * 세션 JWT(`app.jwt`)를 쓰지 않는 이유: 그쪽 payload 는 `SessionUser` 로 고정돼 있고,
 * 같은 키·같은 형식이면 이 토큰을 세션 쿠키에 넣어 로그인한 척할 여지가 생긴다.
 * 여기서는 `purpose` 를 서명에 같이 넣어 용도끼리도 섞이지 않게 한다.
 */
const secret = () => {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error('JWT_SECRET 이 없습니다');
  return value;
};

const mac = (purpose: string, body: string) =>
  createHmac('sha256', secret()).update(`${purpose}.${body}`).digest('base64url');

export function signToken(purpose: string, data: object, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + ttlSeconds * 1000 })).toString('base64url');
  return `${body}.${mac(purpose, body)}`;
}

/** 서명이 틀렸거나 만료됐으면 null */
export function verifyToken<T>(purpose: string, token: string | undefined | null): T | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  const expected = Buffer.from(mac(purpose, body));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString()) as T & { exp: number };
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}
