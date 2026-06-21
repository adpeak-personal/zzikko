import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import bcrypt from 'bcryptjs';
import { getKakaoProfileByCode } from '../lib/kakao';
import { type AuthUser, findOrCreateKakaoUser, issueTokens, rotateTokens, revokeTokens } from '../lib/auth.service';

export default async function authRoutes(app: FastifyInstance) {
  app.get('/kakao/url', async () => {
    const params = new URLSearchParams({
      client_id: process.env.KAKAO_REST_API_KEY || '',
      redirect_uri: process.env.KAKAO_REDIRECT_URI || 'http://localhost:3040/auth/kakao',
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

  app.post<{ Body: { email: string; password: string; mode: 'login' | 'register' } }>(
    '/master',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'mode'],
          properties: {
            email: { type: 'string', minLength: 1 },
            password: { type: 'string', minLength: 1 },
            mode: { type: 'string', enum: ['login', 'register'] },
          },
        },
      },
    },
    async (req, reply) => {
      interface UserRow extends AuthUser { password: string | null }

      const [rows] = await app.db.query<UserRow[]>(
        `SELECT id, email, nickname, role, sns, password FROM users WHERE email = ? AND deleted_at IS NULL LIMIT 1`,
        [req.body.email],
      );

      if (req.body.mode === 'login') {
        const user = rows[0];
        if (!user || !user.password) return reply.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
        const ok = await bcrypt.compare(req.body.password, user.password);
        if (!ok) return reply.unauthorized('이메일 또는 비밀번호가 올바르지 않습니다.');
        await app.db.query(
          `INSERT INTO user_profile (user_id, last_login_at) VALUES (?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE last_login_at = CURRENT_TIMESTAMP`,
          [user.id],
        );
        const tokens = await issueTokens(app, user);
        return { ...tokens, user: { id: user.id, email: user.email, nickname: user.nickname, role: user.role } };
      } else {
        if (rows[0]) return reply.conflict('이미 존재하는 이메일입니다.');
        const hashed = await bcrypt.hash(req.body.password, 12);
        const nickname = req.body.email.split('@')[0];
        const [result] = await app.db.query<ResultSetHeader>(
          `INSERT INTO users (email, password, nickname, sns, role, status) VALUES (?, ?, ?, 'local', 'ADMIN', 'ACTIVE')`,
          [req.body.email, hashed, nickname],
        );
        await app.db.query(
          `INSERT INTO user_profile (user_id, is_verified, last_login_at) VALUES (?, 1, CURRENT_TIMESTAMP)`,
          [result.insertId],
        );
        const [created] = await app.db.query<AuthUser[]>(
          'SELECT id, email, nickname, role, sns FROM users WHERE id = ?',
          [result.insertId],
        );
        const tokens = await issueTokens(app, created[0]);
        return { ...tokens, user: { id: created[0].id, email: created[0].email, nickname: created[0].nickname, role: created[0].role } };
      }
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
