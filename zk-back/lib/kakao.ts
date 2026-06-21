import type { FastifyInstance } from 'fastify';

export interface KakaoProfile {
  snsId: string;
  email: string | null;
  nickname: string | null;
  profileImage: string | null;
  thumbnailImage: string | null;
}

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

interface KakaoMeResponse {
  id: number;
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
      thumbnail_image_url?: string;
    };
  };
}

async function exchangeCodeForToken(app: FastifyInstance, code: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_REST_API_KEY || '',
    redirect_uri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:3040/auth/kakao',
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
  }

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  const data = (await res.json()) as KakaoTokenResponse;

  if (!res.ok || !data.access_token) {
    throw app.httpErrors.badRequest(
      `카카오 토큰 교환 실패: ${data.error_description ?? data.error ?? res.statusText}`,
    );
  }
  return data.access_token;
}

async function fetchKakaoMe(app: FastifyInstance, kakaoAccessToken: string): Promise<KakaoProfile> {
  const res = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${kakaoAccessToken}` },
  });
  if (!res.ok) {
    throw app.httpErrors.badRequest('카카오 사용자 정보 조회 실패');
  }
  const me = (await res.json()) as KakaoMeResponse;
  const profile = me.kakao_account?.profile;

  return {
    snsId: String(me.id),
    email: me.kakao_account?.email ?? null,
    nickname: profile?.nickname ?? null,
    profileImage: profile?.profile_image_url ?? null,
    thumbnailImage: profile?.thumbnail_image_url ?? null,
  };
}

export async function getKakaoProfileByCode(
  app: FastifyInstance,
  code: string,
): Promise<KakaoProfile> {
  const kakaoAccessToken = await exchangeCodeForToken(app, code);
  return fetchKakaoMe(app, kakaoAccessToken);
}
