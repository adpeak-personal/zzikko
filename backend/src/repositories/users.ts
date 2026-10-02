import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import type { Me, PublicUser } from '../types.js';

export interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  nickname: string;
  avatar_color: string;
  level: PublicUser['level'];
  role: PublicUser['role'];
  region: PublicUser['region'];
  shop_id: number | null;
  bio: string | null;
  joined_at: string;
}

export const toPublic = (row: UserRow): PublicUser => ({
  id: row.id,
  nickname: row.nickname,
  avatarColor: row.avatar_color,
  level: row.level,
  role: row.role,
  region: row.region,
  shopId: row.shop_id,
  bio: row.bio,
  joinedAt: row.joined_at,
});

/** 본인에게만 내려주는 형태 — 이메일 포함 */
export const toMe = (row: UserRow): Me => ({ ...toPublic(row), email: row.email });

export async function findByEmail(email: string) {
  return queryOne<UserRow>('SELECT * FROM users WHERE email = ?', [email]);
}

export async function findById(id: number) {
  return queryOne<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
}

export async function emailTaken(email: string) {
  return Boolean(await queryOne('SELECT 1 FROM users WHERE email = ?', [email]));
}

export async function nicknameTaken(nickname: string) {
  return Boolean(await queryOne('SELECT 1 FROM users WHERE nickname = ?', [nickname]));
}

export interface NewUser {
  email: string;
  passwordHash: string;
  nickname: string;
  region: string;
  avatarColor: string;
}

export async function createUser(input: NewUser): Promise<number> {
  const result = await execute(
    'INSERT INTO users (email, password_hash, nickname, region, avatar_color) VALUES (?, ?, ?, ?, ?)',
    [input.email, input.passwordHash, input.nickname, input.region, input.avatarColor],
  );
  return result.insertId;
}

export async function listRecentUsers(limit = 6): Promise<PublicUser[]> {
  const rows = await query<UserRow>('SELECT * FROM users ORDER BY joined_at DESC, id DESC LIMIT ?', [limit]);
  return rows.map(toPublic);
}

export async function countUsers(): Promise<number> {
  const row = await queryOne<RowDataPacket & { total: number }>('SELECT COUNT(*) AS total FROM users');
  return row?.total ?? 0;
}

/** 최근 N일 안에 가입한 회원 수 */
export async function countRecentUsers(days = 7): Promise<number> {
  const row = await queryOne<RowDataPacket & { total: number }>(
    'SELECT COUNT(*) AS total FROM users WHERE joined_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)',
    [days],
  );
  return row?.total ?? 0;
}
