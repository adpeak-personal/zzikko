import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: number;
  email: string | null;
  nickname: string;
  created_at: string;
}

// users 테이블을 다루는 예시 라우트 — /api/users 하위로 등록된다.
export default async function userRoutes(app: FastifyInstance) {
  // 유저 목록 (탈퇴하지 않은 유저)
  app.get('/', async () => {
    const [rows] = await app.db.query<UserRow[]>(
      `SELECT id, email, nickname, created_at
         FROM users
        WHERE deleted_at IS NULL
        ORDER BY id DESC
        LIMIT 50`,
    );
    return rows;
  });

  // 단일 유저 조회
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const [rows] = await app.db.query<UserRow[]>(
      `SELECT id, email, nickname, created_at
         FROM users
        WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id],
    );
    const user = rows[0];
    if (!user) return reply.notFound('유저를 찾을 수 없습니다.');
    return user;
  });
}
