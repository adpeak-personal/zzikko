// 블로그 예약 작업 저장 라우트
//
// POST /api/blog-jobs/bulk
//   Body: { items: [{ title, scheduled_at (ISO), keywords?: string[] }, ...] }
//   1) 최근 N일(DEDUPE_WINDOW_DAYS) 안에 같은 제목이 있으면 건너뜀
//   2) blog_jobs INSERT 후 keywords 가 있으면 blog_job_keywords 에도 INSERT
//   3) 트랜잭션으로 묶어서 부분 실패 방지
//   4) 응답: { saved, skipped_titles, inserted_ids }

import type { FastifyInstance } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface TitleRow extends RowDataPacket {
  title: string;
}

const DEDUPE_WINDOW_DAYS = 20;
const MAX_ITEMS = 200;

// ISO 문자열 → MySQL DATETIME 'YYYY-MM-DD HH:MM:SS' (로컬 타임존 기준)
function toMysqlDateTime(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface InputItem {
  title: string;
  scheduled_at: string;
  keywords?: string[];
}

export default async function blogJobsRoutes(app: FastifyInstance) {
  app.post<{ Body: { items: InputItem[] } }>(
    '/bulk',
    {
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              maxItems: MAX_ITEMS,
              items: {
                type: 'object',
                required: ['title', 'scheduled_at'],
                properties: {
                  title: { type: 'string', minLength: 1, maxLength: 255 },
                  scheduled_at: { type: 'string', minLength: 1 },
                  keywords: {
                    type: 'array',
                    items: { type: 'string', minLength: 1, maxLength: 80 },
                    maxItems: 50,
                  },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const items = req.body.items;

      // 1) 입력 정제 — 제목 trim, 같은 요청 내 제목 중복 제거(앞쪽 우선), DATETIME 변환
      const seenTitle = new Set<string>();
      const cleaned: Array<{
        title: string;
        scheduled_at: string;
        keywords: string[];
      }> = [];
      for (const it of items) {
        const title = it.title.trim();
        if (!title || seenTitle.has(title)) continue;
        const dt = toMysqlDateTime(it.scheduled_at);
        if (!dt) return reply.badRequest(`scheduled_at 형식이 올바르지 않습니다: ${it.scheduled_at}`);
        seenTitle.add(title);
        const kws = Array.from(
          new Set((it.keywords ?? []).map((k) => k.trim()).filter((k) => k.length > 0)),
        );
        cleaned.push({ title, scheduled_at: dt, keywords: kws });
      }
      if (cleaned.length === 0) return reply.badRequest('저장할 항목이 없습니다.');

      // 2) 최근 N일 안에 같은 제목 있는지 한 번에 조회
      const titles = cleaned.map((c) => c.title);
      const [dupRows] = await app.db.query<TitleRow[]>(
        `SELECT title FROM blog_jobs
          WHERE title IN (?)
            AND created_at >= NOW() - INTERVAL ? DAY`,
        [titles, DEDUPE_WINDOW_DAYS],
      );
      const skippedSet = new Set(dupRows.map((r) => r.title));
      const toInsert = cleaned.filter((c) => !skippedSet.has(c.title));

      // 3) 트랜잭션: blog_jobs + blog_job_keywords 동시 INSERT
      const conn = await app.db.getConnection();
      const insertedIds: number[] = [];
      try {
        await conn.beginTransaction();
        for (const item of toInsert) {
          const [jobResult] = await conn.query<ResultSetHeader>(
            `INSERT INTO blog_jobs (title, scheduled_at) VALUES (?, ?)`,
            [item.title, item.scheduled_at],
          );
          const jobId = jobResult.insertId;
          insertedIds.push(jobId);
          if (item.keywords.length > 0) {
            const kwValues = item.keywords.map((k) => [jobId, k]);
            // 한 작업 내 키워드 중복은 UNIQUE(job_id, keyword) 가 막아주지만,
            // 위에서 이미 중복 제거했으므로 그냥 INSERT.
            await conn.query(
              `INSERT INTO blog_job_keywords (job_id, keyword) VALUES ?`,
              [kwValues],
            );
          }
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        app.log.error({ err }, 'blog-jobs/bulk 저장 실패');
        return reply.internalServerError('저장 중 오류가 발생했습니다.');
      } finally {
        conn.release();
      }

      return {
        saved: insertedIds.length,
        skipped: skippedSet.size,
        skipped_titles: Array.from(skippedSet),
        inserted_ids: insertedIds,
        dedupe_window_days: DEDUPE_WINDOW_DAYS,
      };
    },
  );
}
