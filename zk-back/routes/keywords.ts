import type { FastifyInstance } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface KeywordRow extends RowDataPacket {
  id: number;
  category: 'region' | 'phone_model';
  name: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['region', 'phone_model'] as const;
type Category = (typeof CATEGORIES)[number];

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}

// 키워드 정제: 한글/영문/숫자/공백만 남기고 나머지 제거, 공백 중복 정리, 앞뒤 trim
function sanitizeName(raw: string): string {
  return raw
    .replace(/[^가-힣ᄀ-ᇿ㄰-㆏a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default async function keywordRoutes(app: FastifyInstance) {
  // GET /api/keywords?category=region — 카테고리별 키워드 목록
  app.get<{ Querystring: { category?: string } }>('/', async (req, reply) => {
    const { category } = req.query;
    if (category && !isCategory(category)) {
      return reply.badRequest('유효하지 않은 카테고리입니다.');
    }

    const where: string[] = [];
    const params: unknown[] = [];
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await app.db.query<KeywordRow[]>(
      `SELECT id, category, name, sort_order, is_active, created_at, updated_at
         FROM keywords
         ${whereSql}
         ORDER BY category ASC, sort_order ASC, id ASC`,
      params,
    );
    return { items: rows };
  });

  // POST /api/keywords/bulk — 여러 키워드 한꺼번에 추가
  // Body: { category, names: string[] }
  // 같은 (category, name) 이 이미 있으면 무시 (UNIQUE 키 기반 ON DUPLICATE)
  app.post<{ Body: { category: string; names: string[] } }>(
    '/bulk',
    {
      schema: {
        body: {
          type: 'object',
          required: ['category', 'names'],
          properties: {
            category: { type: 'string', enum: [...CATEGORIES] },
            names: {
              type: 'array',
              items: { type: 'string', minLength: 1, maxLength: 80 },
              minItems: 1,
              maxItems: 500,
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { category, names } = req.body;
      if (!isCategory(category)) return reply.badRequest('유효하지 않은 카테고리입니다.');

      // 특수문자 제거 + 공백/중복 정리, 80자 제한
      const cleaned = Array.from(
        new Set(
          names
            .map((n) => sanitizeName(n))
            .filter((n) => n.length > 0 && n.length <= 80),
        ),
      );
      if (cleaned.length === 0) {
        return reply.badRequest('추가할 키워드가 없습니다. (특수문자만 입력되었거나 빈 값입니다)');
      }

      // 마지막 sort_order 다음 값부터 순차 부여
      const [maxRows] = await app.db.query<(RowDataPacket & { max_sort: number | null })[]>(
        `SELECT MAX(sort_order) AS max_sort FROM keywords WHERE category = ?`,
        [category],
      );
      const baseSort = (maxRows[0]?.max_sort ?? 0) + 1;

      const values = cleaned.map((name, i) => [category, name, baseSort + i]);
      const [result] = await app.db.query<ResultSetHeader>(
        `INSERT INTO keywords (category, name, sort_order)
         VALUES ?
         ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
        [values],
      );

      // 추가된(또는 이미 있던) 전체 키워드 반환 — 프론트가 바로 갱신할 수 있도록
      const [rows] = await app.db.query<KeywordRow[]>(
        `SELECT id, category, name, sort_order, is_active, created_at, updated_at
           FROM keywords
          WHERE category = ? AND name IN (?)
          ORDER BY sort_order ASC, id ASC`,
        [category, cleaned],
      );

      return {
        requested: cleaned.length,
        inserted: result.affectedRows, // mysql2: INSERT 1건당 +1, ON DUPLICATE 갱신은 +2 (참고치)
        items: rows,
      };
    },
  );

  // DELETE /api/keywords/bulk — 여러 키워드 한꺼번에 삭제
  // Body: { ids: number[] }
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
      if (ids.length === 0) return reply.badRequest('삭제할 키워드가 없습니다.');

      const [result] = await app.db.query<ResultSetHeader>(
        `DELETE FROM keywords WHERE id IN (?)`,
        [ids],
      );
      return { deleted: result.affectedRows };
    },
  );
}
