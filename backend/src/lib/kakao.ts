/**
 * 카카오 로그인 (REST API 방식).
 *
 * 필요한 값: `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`(콘솔에서 '사용함'으로 켠 경우).
 * Redirect URI 는 `KAKAO_REDIRECT_URI` 가 있으면 그것, 없으면 `CORS_ORIGIN` 의 첫 주소 +
 * `/api/v1/auth/kakao/callback` 이다. **카카오 콘솔에 등록한 주소와 한 글자라도 다르면 KOE006 이 난다.**
 *
 * 동의항목은 닉네임만 쓴다. 이메일은 비즈 앱 심사가 걸릴 수 있고, 우리는 회원번호(id)로 구분하면 된다.
 */
export const kakaoReady = () => Boolean(process.env.KAKAO_REST_API_KEY);

export function kakaoRedirectUri(): string {
  if (process.env.KAKAO_REDIRECT_URI) return process.env.KAKAO_REDIRECT_URI;
  const origin = (process.env.CORS_ORIGIN?.split(',')[0] ?? 'http://localhost:4050').trim().replace(/\/+$/, '');
  return `${origin}/api/v1/auth/kakao/callback`;
}

export function kakaoAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.KAKAO_REST_API_KEY!,
    redirect_uri: kakaoRedirectUri(),
    response_type: 'code',
    state,
  });
  return `https://kauth.kakao.com/oauth/authorize?${params}`;
}

export interface KakaoProfile {
  id: string;
  nickname: string | null;
}

/** 인가 코드 → 액세스 토큰 → 회원 정보. 실패하면 던진다 */
export async function fetchKakaoProfile(code: string): Promise<KakaoProfile> {
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_REST_API_KEY!,
    redirect_uri: kakaoRedirectUri(),
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) form.set('client_secret', process.env.KAKAO_CLIENT_SECRET);

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!tokenRes.ok) throw new Error(`카카오 토큰 ${tokenRes.status}: ${(await tokenRes.text()).slice(0, 300)}`);
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token?: string };
  if (!accessToken) throw new Error('카카오 토큰 응답에 access_token 이 없습니다');

  const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!meRes.ok) throw new Error(`카카오 회원 정보 ${meRes.status}: ${(await meRes.text()).slice(0, 300)}`);
  const me = (await meRes.json()) as {
    id: number | string;
    kakao_account?: { profile?: { nickname?: string } };
    properties?: { nickname?: string };
  };

  return {
    id: String(me.id),
    nickname: me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? null,
  };
}
