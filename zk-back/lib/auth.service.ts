import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { refreshKey } from './token-store';
import { toSeconds } from './duration';
import type { KakaoProfile } from './kakao';

export interface AuthUser extends RowDataPacket {
  id: number;
  email: string;
  nickname: string;
  role: 'BUYER' | 'SELLER' | 'ADMIN' | 'SUB_ADMIN';
  sns: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

async function generateUniqueNickname(app: FastifyInstance, base: string | null): Promise<string> {
  const clean = (base ?? '찍고러').trim().slice(0, 40) || '찍고러';
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? clean : `${clean}${Math.floor(1000 + Math.random() * 9000)}`;
    // users.nickname 과 user_aliases.nickname 어느 쪽이든 겹치면 안 됨.
    const [rows] = await app.db.query<RowDataPacket[]>(
      `SELECT 1 FROM users         WHERE nickname = ? LIMIT 1
       UNION ALL
       SELECT 1 FROM user_aliases  WHERE nickname = ? LIMIT 1`,
      [candidate, candidate],
    );
    if (rows.length === 0) return candidate.slice(0, 50);
  }
  return `${clean}${Date.now()}`.slice(0, 50);
}

export async function findOrCreateKakaoUser(
  app: FastifyInstance,
  profile: KakaoProfile,
): Promise<AuthUser> {
  const [existing] = await app.db.query<AuthUser[]>(
    `SELECT id, email, nickname, role, sns
       FROM users
      WHERE sns = 'kakao' AND sns_id = ? AND deleted_at IS NULL
      LIMIT 1`,
    [profile.snsId],
  );

  if (existing[0]) {
    await app.db.query(
      `INSERT INTO user_profile (user_id, last_login_at) VALUES (?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE last_login_at = CURRENT_TIMESTAMP`,
      [existing[0].id],
    );
    return existing[0];
  }

  const email = profile.email ?? `kakao_${profile.snsId}@zzikko.local`;
  const nickname = await generateUniqueNickname(app, profile.nickname);

  const [result] = await app.db.query<ResultSetHeader>(
    `INSERT INTO users (email, nickname, sns, sns_id, profile_image) VALUES (?, ?, 'kakao', ?, ?)`,
    [email, nickname, profile.snsId, profile.profileImage],
  );

  await app.db.query(
    `INSERT INTO user_profile (user_id, is_verified, last_login_at) VALUES (?, 1, CURRENT_TIMESTAMP)`,
    [result.insertId],
  );

  const [created] = await app.db.query<AuthUser[]>(
    'SELECT id, email, nickname, role, sns FROM users WHERE id = ?',
    [result.insertId],
  );
  return created[0];
}

export async function issueTokens(app: FastifyInstance, user: AuthUser): Promise<IssuedTokens> {
  const accessToken = app.jwt.sign(
    { sub: user.id, role: user.role, type: 'access' },
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '1h' },
  );
  const refreshToken = app.jwt.sign(
    { sub: user.id, role: user.role, type: 'refresh' },
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '14d' },
  );

  await app.tokens.set(
    refreshKey(user.id),
    refreshToken,
    toSeconds(process.env.JWT_REFRESH_EXPIRES || '14d'),
  );

  return { accessToken, refreshToken };
}

export async function rotateTokens(
  app: FastifyInstance,
  refreshToken: string,
): Promise<IssuedTokens> {
  let payload: { sub: number; type: string };
  try {
    payload = app.jwt.verify(refreshToken);
  } catch {
    throw app.httpErrors.unauthorized('유효하지 않은 refresh 토큰입니다.');
  }
  if (payload.type !== 'refresh') {
    throw app.httpErrors.unauthorized('refresh 토큰이 아닙니다.');
  }

  const stored = await app.tokens.get(refreshKey(payload.sub));
  if (!stored || stored !== refreshToken) {
    throw app.httpErrors.unauthorized('만료되었거나 폐기된 토큰입니다. 다시 로그인해주세요.');
  }

  const [rows] = await app.db.query<AuthUser[]>(
    `SELECT id, email, nickname, role, sns
       FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [payload.sub],
  );
  if (!rows[0]) throw app.httpErrors.unauthorized('존재하지 않는 유저입니다.');

  return issueTokens(app, rows[0]);
}

export async function revokeTokens(app: FastifyInstance, userId: number): Promise<void> {
  await app.tokens.del(refreshKey(userId));
}
