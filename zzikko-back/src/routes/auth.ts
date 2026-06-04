import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2';
import { getKakaoProfileByCode } from '../services/kakao.js';
import {
  findOrCreateKakaoUser,
  issueTokens,
  rotateTokens,
  revokeTokens,
} from '../services/auth.service.js';

export default async function authRoutes(app: FastifyInstance) {
  // 카카오 인가 페이지 URL — 프론트가 이 값으로 redirect 한다.
  app.get('/kakao/url', async () => {
    const params = new URLSearchParams({
      client_id: app.config.KAKAO_REST_API_KEY,
      redirect_uri: app.config.KAKAO_REDIRECT_URI,
      response_type: 'code',
    });
    return { url: `https://kauth.kakao.com/oauth/authorize?${params.toString()}` };
  });

  // 카카오 로그인 — 프론트 콜백이 받은 code 를 넘겨주면 우리 토큰을 발급한다.
  app.post<{ Body: { code: string } }>(
    '/kakao',
    {
      schema: {
        body: {
          type: 'object',
          required: ['code'],
          properties: { code: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (req) => {
      const profile = await getKakaoProfileByCode(app, req.body.code);
      const user = await findOrCreateKakaoUser(app, profile);
      const tokens = await issueTokens(app, user);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          userType: user.user_type,
        },
      };
    },
  );

  // access 토큰 재발급 (refresh 회전)
  app.post<{ Body: { refreshToken: string } }>(
    '/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: { refreshToken: { type: 'string', minLength: 1 } },
        },
      },
    },
    async (req) => {
      return rotateTokens(app, req.body.refreshToken);
    },
  );

  // 로그아웃 — 저장된 refresh 토큰 폐기
  app.post('/logout', { preHandler: app.authenticate }, async (req) => {
    await revokeTokens(app, req.user.sub);
    return { ok: true };
  });

  // 내 정보 — access 토큰으로 현재 로그인 유저 조회
  app.get('/me', { preHandler: app.authenticate }, async (req, reply) => {
    const [rows] = await app.db.query<RowDataPacket[]>(
      `SELECT id, email, nickname, user_type, level, profile_image, created_at
         FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
      [req.user.sub],
    );
    if (!rows[0]) return reply.notFound('유저를 찾을 수 없습니다.');
    return rows[0];
  });
}
