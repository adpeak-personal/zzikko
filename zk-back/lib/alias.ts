// 작성자의 활성 alias 중 랜덤 하나 뽑기.
// alias 가 하나도 없으면 null → posts.display_nickname = NULL → users.nickname 으로 표시.

import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2';

interface AliasNameRow extends RowDataPacket {
  nickname: string;
}

export async function pickRandomAlias(
  app: FastifyInstance,
  userId: number,
): Promise<string | null> {
  if (!userId) return null;
  // ORDER BY RAND() 은 작은 테이블(수십~수백 행)엔 충분히 빠름.
  const [rows] = await app.db.query<AliasNameRow[]>(
    `SELECT nickname FROM user_aliases
      WHERE user_id = ? AND is_active = 1
      ORDER BY RAND()
      LIMIT 1`,
    [userId],
  );
  return rows[0]?.nickname ?? null;
}
