// 닉네임 alias 관리 — 어드민이 일괄 추가/삭제/토글
//
//   GET    /api/admin/aliases?user_id=13           목록
//   POST   /api/admin/aliases                     Body: { user_id, nicknames: string[] }  일괄 추가
//   DELETE /api/admin/aliases/bulk                Body: { ids: number[] }                 일괄 삭제
//   PATCH  /api/admin/aliases/:id                 Body: { is_active?: 0|1 }                활성 토글
//
// 추가/수정 시점에 users.nickname / 다른 alias 와 중복 검사 (앱 레이어).

import type { FastifyInstance } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface AliasRow extends RowDataPacket {
  id: number;
  user_id: number;
  nickname: string;
  is_active: number;
  sort_order: number;
  created_at: string;
}

// 닉네임 정제: 한글/영문/숫자/공백만 허용 (keywords 와 동일 규칙)
function sanitizeNickname(raw: string): string {
  return raw
    .replace(/[^가-힣ᄀ-ᇿ㄰-㆏a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function aliasRoutes(app: FastifyInstance) {
  // GET /api/admin/aliases?user_id=13
  app.get<{ Querystring: { user_id?: string } }>('/', async (req, reply) => {
    const userId = Number(req.query.user_id);
    if (!Number.isInteger(userId) || userId < 1) {
      return reply.badRequest('user_id 가 필요합니다.');
    }
    const [rows] = await app.db.query<AliasRow[]>(
      `SELECT id, user_id, nickname, is_active, sort_order, created_at
         FROM user_aliases
        WHERE user_id = ?
        ORDER BY sort_order ASC, id ASC`,
      [userId],
    );
    return { items: rows };
  });

  // POST /api/admin/aliases — 일괄 추가
  // Body: { user_id, nicknames: string[] }
  // 중복 (users.nickname / 다른 user_aliases.nickname) 자동 스킵
  app.post<{ Body: { user_id: number; nicknames: string[] } }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['user_id', 'nicknames'],
          properties: {
            user_id: { type: 'integer', minimum: 1 },
            nicknames: {
              type: 'array',
              items: { type: 'string', minLength: 1, maxLength: 50 },
              minItems: 1,
              maxItems: 200,
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { user_id, nicknames } = req.body;

      // 정제 + 중복 제거
      const cleaned = Array.from(
        new Set(
          nicknames.map(sanitizeNickname).filter((n) => n.length > 0 && n.length <= 50),
        ),
      );
      if (cleaned.length === 0) {
        return reply.badRequest('추가할 닉네임이 없습니다.');
      }

      // 1) users.nickname 과 충돌하는 것 체크
      const [userDup] = await app.db.query<(RowDataPacket & { nickname: string })[]>(
        `SELECT nickname FROM users WHERE nickname IN (?)`,
        [cleaned],
      );
      // 2) user_aliases.nickname 과 충돌하는 것 체크 (UNIQUE 제약이라 INSERT 시도 시 에러나지만 미리 메시지 친화적으로)
      const [aliasDup] = await app.db.query<(RowDataPacket & { nickname: string })[]>(
        `SELECT nickname FROM user_aliases WHERE nickname IN (?)`,
        [cleaned],
      );

      const conflictSet = new Set<string>([
        ...userDup.map((r) => r.nickname),
        ...aliasDup.map((r) => r.nickname),
      ]);
      const toInsert = cleaned.filter((n) => !conflictSet.has(n));

      let inserted = 0;
      if (toInsert.length > 0) {
        // 마지막 sort_order + 1 부터 부여
        const [maxRows] = await app.db.query<(RowDataPacket & { max_sort: number | null })[]>(
          `SELECT MAX(sort_order) AS max_sort FROM user_aliases WHERE user_id = ?`,
          [user_id],
        );
        const baseSort = (maxRows[0]?.max_sort ?? 0) + 1;
        const values = toInsert.map((n, i) => [user_id, n, baseSort + i]);
        const [result] = await app.db.query<ResultSetHeader>(
          `INSERT INTO user_aliases (user_id, nickname, sort_order) VALUES ?`,
          [values],
        );
        inserted = result.affectedRows;
      }

      return {
        requested: cleaned.length,
        inserted,
        skipped: cleaned.length - toInsert.length,
        skipped_nicknames: Array.from(conflictSet),
      };
    },
  );

  // DELETE /api/admin/aliases/bulk — Body: { ids: number[] }
  app.delete<{ Body: { ids: number[] } }>(
    '/bulk',
    {
      schema: {
        body: {
          type: 'object',
          required: ['ids'],
          properties: {
            ids: {
              type: 'array',
              items: { type: 'integer', minimum: 1 },
              minItems: 1,
              maxItems: 500,
            },
          },
        },
      },
    },
    async (req, reply) => {
      const ids = Array.from(new Set(req.body.ids));
      if (ids.length === 0) return reply.badRequest('삭제할 항목이 없습니다.');
      const [result] = await app.db.query<ResultSetHeader>(
        `DELETE FROM user_aliases WHERE id IN (?)`,
        [ids],
      );
      return { deleted: result.affectedRows };
    },
  );

  // PATCH /api/admin/aliases/:id — { is_active: 0|1 }
  app.patch<{ Params: { id: string }; Body: { is_active?: 0 | 1 } }>(
    '/:id',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');
      const { is_active } = req.body ?? {};
      if (is_active !== 0 && is_active !== 1) {
        return reply.badRequest('is_active 는 0 또는 1 이어야 합니다.');
      }
      const [result] = await app.db.query<ResultSetHeader>(
        `UPDATE user_aliases SET is_active = ? WHERE id = ?`,
        [is_active, id],
      );
      if (result.affectedRows === 0) return reply.notFound('찾을 수 없습니다.');
      return { ok: true };
    },
  );
}
