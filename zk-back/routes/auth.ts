import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2';
import { getKakaoProfileByCode } from '../lib/kakao';
import { findOrCreateKakaoUser, issueTokens, rotateTokens, revokeTokens } from '../lib/auth.service';

export default async function authRoutes(app: FastifyInstance) {
  app.get('/kakao/url', async () => {
    const params = new URLSearchParams({
      client_id: process.env.KAKAO_REST_API_KEY || '',
      redirect_uri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:3000/auth/kakao',
      response_type: 'code',
    });
    return { url: `https://kauth.kakao.com/oauth/authorize?${params.toString()}` };
  });

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
        user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role },
      };
    },
  );

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

  app.post('/logout', { preHandler: app.authenticate }, async (req) => {
    await revokeTokens(app, req.user.sub);
    return { ok: true };
  });

  app.get('/me', { preHandler: app.authenticate }, async (req, reply) => {
    const [rows] = await app.db.query<RowDataPacket[]>(
      `SELECT u.id, u.email, u.nickname, u.role, u.profile_image, u.created_at, up.level
         FROM users u
         LEFT JOIN user_profile up ON up.user_id = u.id
        WHERE u.id = ? AND u.deleted_at IS NULL LIMIT 1`,
      [req.user.sub],
    );
    if (!rows[0]) return reply.notFound('유저를 찾을 수 없습니다.');
    return rows[0];
  });
}
