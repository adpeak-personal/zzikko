import type { Pool } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import type { TokenStore } from './token-store';

export class DbTokenStore implements TokenStore {
  constructor(private db: Pool) {}

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const userId = parseUserId(key);
    if (!userId) return;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.db.query(`DELETE FROM user_tokens WHERE user_id = ?`, [userId]);
    await this.db.query(
      `INSERT INTO user_tokens (user_id, refresh_token, expires_at) VALUES (?, ?, ?)`,
      [userId, value, expiresAt],
    );
  }

  async get(key: string): Promise<string | null> {
    const userId = parseUserId(key);
    if (!userId) return null;
    const [rows] = await this.db.query<RowDataPacket[]>(
      `SELECT refresh_token FROM user_tokens WHERE user_id = ? AND expires_at > NOW() LIMIT 1`,
      [userId],
    );
    return (rows[0]?.refresh_token as string) ?? null;
  }

  async del(key: string): Promise<void> {
    const userId = parseUserId(key);
    if (!userId) return;
    await this.db.query(`DELETE FROM user_tokens WHERE user_id = ?`, [userId]);
  }
}

function parseUserId(key: string): number | null {
  const match = key.match(/^auth:refresh:(\d+)$/);
  return match ? Number(match[1]) : null;
}
