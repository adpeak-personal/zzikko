import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { refreshKey } from '../lib/token-store.js';
import { toSeconds } from '../lib/duration.js';
import type { KakaoProfile } from './kakao.js';

export interface AuthUser extends RowDataPacket {
  id: number;
  email: string;
  nickname: string;
  user_type: 'BUYER' | 'SELLER' | 'ADMIN';
  sns: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

// nickname 은 NOT NULL 이라 가입 시 비어있지 않은 값을 만들어준다(중복도 회피).
async function generateUniqueNickname(app: FastifyInstance, base: string | null): Promise<string> {
  const clean = (base ?? '찍고러').trim().slice(0, 40) || '찍고러';
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? clean : `${clean}${Math.floor(1000 + Math.random() * 9000)}`;
    const [rows] = await app.db.query<RowDataPacket[]>(
      'SELECT 1 FROM users WHERE nickname = ? LIMIT 1',
      [candidate],
    );
    if (rows.length === 0) return candidate.slice(0, 50);
  }
  return `${clean}${Date.now()}`.slice(0, 50);
}

// 카카오 프로필로 유저를 찾거나(가입) 가져온다.
export async function findOrCreateKakaoUser(
  app: FastifyInstance,
  profile: KakaoProfile,
): Promise<AuthUser> {
  const [existing] = await app.db.query<AuthUser[]>(
    `SELECT id, email, nickname, user_type, sns
       FROM users
      WHERE sns = 'kakao' AND sns_id = ? AND deleted_at IS NULL
      LIMIT 1`,
    [profile.snsId],
  );

  if (existing[0]) {
    await app.db.query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [
      existing[0].id,
    ]);
    return existing[0];
  }

  // 신규 가입 — email 은 NOT NULL 이라 미제공 시 대체값 사용
  const email = profile.email ?? `kakao_${profile.snsId}@zzikko.local`;
  const nickname = await generateUniqueNickname(app, profile.nickname);

  const [result] = await app.db.query<ResultSetHeader>(
    `INSERT INTO users (email, nickname, sns, sns_id, profile_image, is_verified, last_login_at)
     VALUES (?, ?, 'kakao', ?, ?, 1, CURRENT_TIMESTAMP)`,
    [email, nickname, profile.snsId, profile.profileImage],
  );

  const [created] = await app.db.query<AuthUser[]>(
    'SELECT id, email, nickname, user_type, sns FROM users WHERE id = ?',
    [result.insertId],
  );
  return created[0];
}

// access + refresh 토큰 발급 후 refresh 를 저장소에 보관
export async function issueTokens(app: FastifyInstance, user: AuthUser): Promise<IssuedTokens> {
  const accessToken = app.jwt.sign(
    { sub: user.id, role: user.user_type, type: 'access' },
    { expiresIn: app.config.JWT_ACCESS_EXPIRES },
  );
  const refreshToken = app.jwt.sign(
    { sub: user.id, role: user.user_type, type: 'refresh' },
    { expiresIn: app.config.JWT_REFRESH_EXPIRES },
  );

  await app.tokens.set(
    refreshKey(user.id),
    refreshToken,
    toSeconds(app.config.JWT_REFRESH_EXPIRES),
  );

  return { accessToken, refreshToken };
}

// refresh 토큰 검증 → 저장소 값과 대조 → 새 토큰 재발급(회전)
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
    `SELECT id, email, nickname, user_type, sns
       FROM users WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [payload.sub],
  );
  if (!rows[0]) throw app.httpErrors.unauthorized('존재하지 않는 유저입니다.');

  return issueTokens(app, rows[0]);
}

// 로그아웃: 저장된 refresh 토큰 폐기
export async function revokeTokens(app: FastifyInstance, userId: number): Promise<void> {
  await app.tokens.del(refreshKey(userId));
}
