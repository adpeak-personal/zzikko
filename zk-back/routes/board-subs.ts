// board_subs (게시판 서브카테고리) 관리 API
//
// public
//   GET    /api/board-subs?board=community           board_slug 로 sort_order 정렬 목록
//
// admin (인증 가드 정책은 codebase 관례 따름 — 별도 미들웨어 없음)
//   POST   /api/board-subs                           { board_slug, slug, title, icon?, hidden_from_nav?, sort_order? }
//   PATCH  /api/board-subs/:id                       { title?, icon?, hidden_from_nav?, sort_order? }  (slug 는 immutable)
//   DELETE /api/board-subs/:id                       참조 posts 있으면 409 로 차단
//   POST   /api/board-subs/reorder                   { items: [{ id, sort_order }, ...] }  드래그 정렬 일괄 갱신

import type { FastifyInstance } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface BoardSubRow extends RowDataPacket {
  id: number;
  board_slug: string;
  slug: string;
  title: string;
  icon: string | null;
  hidden_from_nav: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// slug 는 URL 세그먼트로 쓰이므로 영문 소문자/숫자/하이픈만 허용 (32자 이내).
function isValidSlug(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(s);
}

export default async function boardSubsRoutes(app: FastifyInstance) {
  // GET /api/board-subs?board=community
  //   board 필수. 정렬: sort_order ASC, id ASC.
  //   hidden_from_nav 여부와 무관하게 전부 리턴 — 프론트 렌더 시 role 로 필터.
  app.get<{ Querystring: { board?: string } }>('/', async (req, reply) => {
    const board = (req.query.board ?? '').trim();
    if (!board) return reply.badRequest('board 파라미터가 필요합니다.');

    const [rows] = await app.db.query<BoardSubRow[]>(
      `SELECT id, board_slug, slug, title, icon, hidden_from_nav, sort_order,
              created_at, updated_at
         FROM board_subs
        WHERE board_slug = ?
        ORDER BY sort_order ASC, id ASC`,
      [board],
    );
    // public 응답 — 5분 캐시 (프론트에서도 revalidate 같은 창)
    reply.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return { items: rows };
  });

  // POST /api/board-subs
  //   slug 는 immutable — 여기서만 지정 가능. 이후 PATCH 에서 못 바꿈.
  //   같은 board 내 slug 중복은 UNIQUE 제약이 막지만, 400 으로 친화적 메시지.
  app.post<{
    Body: {
      board_slug: string;
      slug: string;
      title: string;
      icon?: string | null;
      hidden_from_nav?: 0 | 1 | boolean;
      sort_order?: number;
    };
  }>(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['board_slug', 'slug', 'title'],
          properties: {
            board_slug: { type: 'string', minLength: 1, maxLength: 50 },
            slug: { type: 'string', minLength: 1, maxLength: 50 },
            title: { type: 'string', minLength: 1, maxLength: 100 },
            icon: { type: ['string', 'null'], maxLength: 20 },
            hidden_from_nav: { type: ['integer', 'boolean'] },
            sort_order: { type: 'integer' },
          },
        },
      },
    },
    async (req, reply) => {
      const { board_slug, slug, title, icon = null, hidden_from_nav, sort_order } = req.body;
      if (!isValidSlug(slug)) {
        return reply.badRequest('slug 는 영문 소문자/숫자/하이픈 만 허용됩니다 (예: hotdeal, offline-review).');
      }

      // sort_order 미지정 시 해당 board 마지막 순서 + 10 (드래그 여유용)
      let order = sort_order;
      if (order == null) {
        const [maxRows] = await app.db.query<(RowDataPacket & { max_sort: number | null })[]>(
          `SELECT MAX(sort_order) AS max_sort FROM board_subs WHERE board_slug = ?`,
          [board_slug],
        );
        order = (maxRows[0]?.max_sort ?? 0) + 10;
      }

      const hidden = hidden_from_nav ? 1 : 0;

      try {
        const [result] = await app.db.query<ResultSetHeader>(
          `INSERT INTO board_subs (board_slug, slug, title, icon, hidden_from_nav, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [board_slug, slug, title, icon || null, hidden, order],
        );
        return { id: result.insertId };
      } catch (err) {
        // MySQL ER_DUP_ENTRY = 1062 → 같은 (board_slug, slug) 이미 존재
        const code = (err as { code?: string } | null)?.code;
        if (code === 'ER_DUP_ENTRY') {
          return reply.conflict(`이미 존재하는 슬러그입니다: ${board_slug}/${slug}`);
        }
        throw err;
      }
    },
  );

  // PATCH /api/board-subs/:id
  //   title / icon / hidden_from_nav / sort_order 만 수정. slug 는 immutable — 요청에 있어도 무시.
  app.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      icon?: string | null;
      hidden_from_nav?: 0 | 1 | boolean;
      sort_order?: number;
    };
  }>('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');

    const sets: string[] = [];
    const params: unknown[] = [];
    const { title, icon, hidden_from_nav, sort_order } = req.body ?? {};

    if (title !== undefined) {
      if (!title.trim() || title.length > 100) {
        return reply.badRequest('title 은 1~100자 여야 합니다.');
      }
      sets.push('title = ?');
      params.push(title.trim());
    }
    if (icon !== undefined) {
      sets.push('icon = ?');
      params.push(icon ? String(icon).slice(0, 20) : null);
    }
    if (hidden_from_nav !== undefined) {
      sets.push('hidden_from_nav = ?');
      params.push(hidden_from_nav ? 1 : 0);
    }
    if (sort_order !== undefined) {
      sets.push('sort_order = ?');
      params.push(sort_order);
    }

    if (sets.length === 0) return reply.badRequest('수정할 필드가 없습니다.');

    params.push(id);
    const [result] = await app.db.query<ResultSetHeader>(
      `UPDATE board_subs SET ${sets.join(', ')} WHERE id = ?`,
      params,
    );
    if (result.affectedRows === 0) return reply.notFound('찾을 수 없습니다.');
    return { ok: true };
  });

  // DELETE /api/board-subs/:id
  //   해당 sub 를 참조하는 posts 가 하나라도 있으면 409 — 데이터 orphan 방지.
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');

    const [rows] = await app.db.query<BoardSubRow[]>(
      `SELECT board_slug, slug FROM board_subs WHERE id = ? LIMIT 1`,
      [id],
    );
    const sub = rows[0];
    if (!sub) return reply.notFound('찾을 수 없습니다.');

    const [[{ n }]] = (await app.db.query(
      `SELECT COUNT(*) AS n FROM posts
        WHERE board_slug = ? AND sub_slug = ? AND status <> 'DELETED'`,
      [sub.board_slug, sub.slug],
    )) as unknown as [Array<{ n: number }>];

    if (Number(n) > 0) {
      return reply.conflict(
        `이 서브를 참조하는 게시글이 ${n}건 있습니다. 게시글을 먼저 이관/삭제해주세요.`,
      );
    }

    await app.db.query<ResultSetHeader>(`DELETE FROM board_subs WHERE id = ?`, [id]);
    return { ok: true };
  });

  // POST /api/board-subs/reorder
  //   드래그 정렬 확정 시 일괄 갱신. items 안에 { id, sort_order } 배열.
  app.post<{ Body: { items: Array<{ id: number; sort_order: number }> } }>(
    '/reorder',
    {
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              maxItems: 500,
              items: {
                type: 'object',
                required: ['id', 'sort_order'],
                properties: {
                  id: { type: 'integer', minimum: 1 },
                  sort_order: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const { items } = req.body;
      const conn = await app.db.getConnection();
      try {
        await conn.beginTransaction();
        for (const it of items) {
          await conn.query(
            `UPDATE board_subs SET sort_order = ? WHERE id = ?`,
            [it.sort_order, it.id],
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
      return { updated: items.length };
    },
  );
}
