import type { FastifyInstance } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface UserRow extends RowDataPacket {
  id: number;
  email: string | null;
  nickname: string;
  role: string;
  status: string;
  created_at: string;
}

const ROLES = ['BUYER', 'SELLER', 'ADMIN', 'SUB_ADMIN'];
const STATUSES = ['ACTIVE', 'INACTIVE', 'BANNED', 'DELETED'];

export default async function userRoutes(app: FastifyInstance) {
  // 회원 목록 (검색 + 페이지네이션) — 어드민 회원관리
  app.get<{ Querystring: { q?: string; page?: string; limit?: string } }>(
    '/',
    async (req) => {
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
      const offset = (page - 1) * limit;
      const q = (req.query.q ?? '').trim();

      const where = ['deleted_at IS NULL'];
      const params: unknown[] = [];
      if (q) {
        where.push('(nickname LIKE ? OR email LIKE ?)');
        params.push(`%${q}%`, `%${q}%`);
      }
      const whereSql = where.join(' AND ');

      const [rows] = await app.db.query<UserRow[]>(
        `SELECT id, email, nickname, role, status, created_at
           FROM users
          WHERE ${whereSql}
          ORDER BY id DESC
          LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );
      const [countRows] = await app.db.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM users WHERE ${whereSql}`,
        params,
      );

      return {
        items: rows,
        total: countRows[0]?.total ?? 0,
        page,
        limit,
      };
    },
  );

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const [rows] = await app.db.query<UserRow[]>(
      `SELECT id, email, nickname, role, status, created_at
         FROM users
        WHERE id = ? AND deleted_at IS NULL`,
      [req.params.id],
    );
    const user = rows[0];
    if (!user) return reply.notFound('유저를 찾을 수 없습니다.');
    return user;
  });

  // 회원 권한/상태 변경 — 어드민
  app.patch<{ Params: { id: string }; Body: { role?: string; status?: string } }>(
    '/:id',
    async (req, reply) => {
      const { role, status } = req.body ?? {};
      const sets: string[] = [];
      const params: unknown[] = [];

      if (role !== undefined) {
        if (!ROLES.includes(role)) return reply.badRequest('유효하지 않은 권한입니다.');
        sets.push('role = ?');
        params.push(role);
      }
      if (status !== undefined) {
        if (!STATUSES.includes(status)) return reply.badRequest('유효하지 않은 상태입니다.');
        sets.push('status = ?');
        params.push(status);
      }
      if (sets.length === 0) return reply.badRequest('변경할 내용이 없습니다.');

      const [result] = await app.db.query<ResultSetHeader>(
        `UPDATE users SET ${sets.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
        [...params, req.params.id],
      );
      if (result.affectedRows === 0) return reply.notFound('유저를 찾을 수 없습니다.');

      const [rows] = await app.db.query<UserRow[]>(
        `SELECT id, email, nickname, role, status, created_at FROM users WHERE id = ?`,
        [req.params.id],
      );
      return rows[0];
    },
  );
}
