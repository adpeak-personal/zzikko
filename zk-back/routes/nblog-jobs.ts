// nblog_jobs 예약 관리 라우트.
//
// 어드민 (등록 · 조회 · 삭제)
//   POST   /api/nblog-jobs/bulk      Body: { items: [{ n_idx, category, keyword?, title?, scheduled_at }] }
//   GET    /api/nblog-jobs?status=&limit=      최근 예약 목록
//   DELETE /api/nblog-jobs/:id                 개별 삭제
//
// 파이썬 워커용 (인증 없이 폴링. 필요하면 나중에 별도 토큰/스코프 추가)
//   GET    /api/nblog-jobs/due       현재 시각 이전 PENDING 1건 + nwork 계정정보 조인
//   PATCH  /api/nblog-jobs/:id/claim     PENDING → PROCESSING 원자적 선점
//   PATCH  /api/nblog-jobs/:id/complete  { title, keyword?, result_url? } → DONE
//   PATCH  /api/nblog-jobs/:id/fail      { error } → FAILED

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

const VALID_CATEGORIES = ['cate1', 'cate2', 'cate3', 'cate4'] as const;
type Category = (typeof VALID_CATEGORIES)[number];
const VALID_LINK_STYLES = ['anchor', 'onbox', 'nobox'] as const;
type LinkStyle = (typeof VALID_LINK_STYLES)[number];
const MAX_ITEMS = 500;

interface InputItem {
  n_idx: number;
  category: string;
  keyword?: string;
  title?: string;
  scheduled_at: string;
  link?: string;
  link_style?: string;
  /** anchor 스타일일 때 사용할 앵커 텍스트. 비면 워커가 keyword 로 폴백. */
  link_keyword?: string;
}

interface JobRow extends RowDataPacket {
  id: number;
  n_idx: number;
  category: Category;
  keyword: string | null;
  title: string | null;
  link: string | null;
  link_style: LinkStyle | null;
  link_keyword: string | null;
  scheduled_at: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  result_url: string | null;
  error: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface JobWithAccountRow extends JobRow {
  n_id: string;
  n_pwd: string;
  work_user_agent: number | null;
  work_profile: string | null;
}

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const role = req.user?.role;
  if (role !== 'ADMIN' && role !== 'SUB_ADMIN') {
    return reply.forbidden('관리자만 접근할 수 있습니다.');
  }
}

// ISO 문자열 → MySQL DATETIME (로컬 타임존 기준). blog-jobs 와 동일 규칙.
function toMysqlDateTime(iso: string): string | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default async function nblogJobsRoutes(app: FastifyInstance) {
  // ───────────────────────────────────────────────────────────
  // 어드민 — 일괄 등록
  // ───────────────────────────────────────────────────────────
  app.post<{ Body: { items: InputItem[] } }>(
    '/bulk',
    {
      preHandler: [app.authenticate, requireAdmin],
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
                required: ['n_idx', 'category', 'scheduled_at'],
                properties: {
                  n_idx: { type: 'integer', minimum: 1 },
                  category: { type: 'string', enum: [...VALID_CATEGORIES] },
                  keyword: { type: 'string', maxLength: 200 },
                  title: { type: 'string', maxLength: 255 },
                  scheduled_at: { type: 'string', minLength: 1 },
                  link: { type: 'string', maxLength: 500 },
                  link_style: { type: 'string', enum: [...VALID_LINK_STYLES] },
                  link_keyword: { type: 'string', maxLength: 200 },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const items = req.body.items;

      // 1) 정제 — cate3/4 는 keyword 필수, DATETIME 변환, 빈 문자열 → null
      const cleaned: Array<{
        n_idx: number;
        category: Category;
        keyword: string | null;
        title: string | null;
        scheduled_at: string;
        link: string | null;
        link_style: LinkStyle | null;
        link_keyword: string | null;
      }> = [];
      for (const it of items) {
        const cat = it.category as Category;
        const kw = it.keyword?.trim() || null;
        if ((cat === 'cate3' || cat === 'cate4') && !kw) {
          return reply.badRequest(`${cat} 는 keyword 가 필요합니다.`);
        }
        const dt = toMysqlDateTime(it.scheduled_at);
        if (!dt) return reply.badRequest(`scheduled_at 형식 오류: ${it.scheduled_at}`);

        // link / link_style 정합성 — 둘 다 있거나 둘 다 없거나
        const link = it.link?.trim() || null;
        const linkStyle = (it.link_style as LinkStyle | undefined) || null;
        if (link && !linkStyle) {
          return reply.badRequest(`link 이 있으면 link_style 도 필요합니다.`);
        }
        if (linkStyle && !link) {
          return reply.badRequest(`link_style 만 있고 link 이 비어있습니다.`);
        }
        if (link && !/^https?:\/\//i.test(link)) {
          return reply.badRequest(`link 는 http:// 또는 https:// 로 시작해야 합니다: ${link}`);
        }
        // link_keyword 는 링크가 있고 anchor 스타일일 때만 의미 있음. 그 외엔 조용히 무시.
        const linkKw =
          link && linkStyle === 'anchor' ? it.link_keyword?.trim() || null : null;

        cleaned.push({
          n_idx: it.n_idx,
          category: cat,
          keyword: kw,
          title: it.title?.trim() || null,
          scheduled_at: dt,
          link,
          link_style: linkStyle,
          link_keyword: linkKw,
        });
      }

      // 2) n_idx 유효성 — 블로그 역할 + 사용가능 인지 검증
      const nIdxs = Array.from(new Set(cleaned.map((c) => c.n_idx)));
      const [nworkRows] = await app.db.query<
        (RowDataPacket & { n_idx: number; task_role: string; use_status: number })[]
      >(`SELECT n_idx, task_role, use_status FROM nwork WHERE n_idx IN (?)`, [nIdxs]);
      const validSet = new Set(
        nworkRows
          .filter((r) => r.task_role === '블로그' && r.use_status === 1)
          .map((r) => r.n_idx),
      );
      const invalidIdxs = nIdxs.filter((i) => !validSet.has(i));
      if (invalidIdxs.length > 0) {
        return reply.badRequest(
          `유효하지 않은 계정: ${invalidIdxs.join(', ')} — 블로그 역할 + 사용가능 상태여야 합니다.`,
        );
      }

      // 3) 일괄 INSERT — 하나라도 실패하면 전체 롤백
      const values = cleaned.map((c) => [
        c.n_idx,
        c.category,
        c.keyword,
        c.title,
        c.scheduled_at,
        c.link,
        c.link_style,
        c.link_keyword,
      ]);
      const conn = await app.db.getConnection();
      let insertedIds: number[] = [];
      try {
        await conn.beginTransaction();
        const [result] = await conn.query<ResultSetHeader>(
          `INSERT INTO nblog_jobs
             (n_idx, category, keyword, title, scheduled_at, link, link_style, link_keyword)
           VALUES ?`,
          [values],
        );
        // MySQL bulk insert: insertId = 첫 id, 연속으로 affectedRows 만큼 부여
        insertedIds = Array.from(
          { length: result.affectedRows },
          (_, i) => result.insertId + i,
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        app.log.error({ err }, 'nblog-jobs/bulk 저장 실패');
        return reply.internalServerError('저장 중 오류가 발생했습니다.');
      } finally {
        conn.release();
      }

      return {
        saved: insertedIds.length,
        inserted_ids: insertedIds,
      };
    },
  );

  // ───────────────────────────────────────────────────────────
  // 어드민 — 목록
  //   ?status=PENDING|PROCESSING|DONE|FAILED   (선택)
  //   ?limit=100 (기본 100, 최대 500)
  //   정렬: scheduled_at ASC, id ASC   (다음에 발행될 순서)
  // ───────────────────────────────────────────────────────────
  app.get<{ Querystring: { status?: string; limit?: string } }>(
    '/',
    { preHandler: [app.authenticate, requireAdmin] },
    async (req, reply) => {
      const VALID = ['PENDING', 'PROCESSING', 'DONE', 'FAILED'];
      const status = req.query.status;
      if (status && !VALID.includes(status)) {
        return reply.badRequest('유효하지 않은 status 입니다.');
      }
      const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));

      const where: string[] = [];
      const params: unknown[] = [];
      if (status) {
        where.push('j.status = ?');
        params.push(status);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

      const [rows] = await app.db.query<JobWithAccountRow[]>(
        `SELECT j.id, j.n_idx, j.category, j.keyword, j.title,
                j.link, j.link_style, j.link_keyword, j.scheduled_at,
                j.status, j.result_url, j.error, j.published_at,
                j.created_at, j.updated_at,
                n.n_id, n.work_user_agent, n.work_profile
           FROM nblog_jobs j
           LEFT JOIN nwork n ON n.n_idx = j.n_idx
           ${whereSql}
           ORDER BY j.scheduled_at ASC, j.id ASC
           LIMIT ?`,
        [...params, limit],
      );

      // 상태별 카운트 (필터와 무관하게 전체)
      const [statusRows] = await app.db.query<
        (RowDataPacket & { status: string; n: number })[]
      >(`SELECT status, COUNT(*) AS n FROM nblog_jobs GROUP BY status`);
      const counts: Record<string, number> = {
        PENDING: 0,
        PROCESSING: 0,
        DONE: 0,
        FAILED: 0,
      };
      for (const r of statusRows) counts[r.status] = Number(r.n);

      return { items: rows, counts };
    },
  );

  // ───────────────────────────────────────────────────────────
  // 어드민 — 개별 삭제
  // ───────────────────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [app.authenticate, requireAdmin] },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');
      const [result] = await app.db.query<ResultSetHeader>(
        `DELETE FROM nblog_jobs WHERE id = ?`,
        [id],
      );
      if (result.affectedRows === 0) return reply.notFound('예약을 찾을 수 없습니다.');
      return { ok: true, deleted: result.affectedRows };
    },
  );

  // ───────────────────────────────────────────────────────────
  // 파이썬 워커용 — 다음 due 픽업
  //   scheduled_at <= NOW() & status='PENDING' 중 가장 이른 1건 + 계정 정보.
  // ───────────────────────────────────────────────────────────
  app.get('/due', async (_req) => {
    const [rows] = await app.db.query<JobWithAccountRow[]>(
      `SELECT j.id, j.n_idx, j.category, j.keyword, j.title,
              j.link, j.link_style, j.link_keyword, j.scheduled_at,
              j.status, j.result_url, j.error, j.published_at,
              j.created_at, j.updated_at,
              n.n_id, n.n_pwd, n.work_user_agent, n.work_profile
         FROM nblog_jobs j
         LEFT JOIN nwork n ON n.n_idx = j.n_idx
        WHERE j.status = 'PENDING' AND j.scheduled_at <= NOW()
        ORDER BY j.scheduled_at ASC, j.id ASC
        LIMIT 1`,
    );
    const job = rows[0];
    if (!job) return { job: null };
    return { job };
  });

  // 워커 — PENDING → PROCESSING 원자적 전환. 이미 다른 워커가 잡았으면 409.
  app.patch<{ Params: { id: string } }>('/:id/claim', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');
    const [result] = await app.db.query<ResultSetHeader>(
      `UPDATE nblog_jobs SET status = 'PROCESSING'
        WHERE id = ? AND status = 'PENDING'`,
      [id],
    );
    if (result.affectedRows === 0) {
      return reply.conflict('이미 다른 워커가 처리 중이거나 PENDING 이 아닙니다.');
    }
    return { ok: true, id };
  });

  // 워커 — 완료 처리. 워커가 최종 title/keyword/result_url 을 채워 보냄.
  app.patch<{
    Params: { id: string };
    Body: { title?: string; keyword?: string; result_url?: string };
  }>(
    '/:id/complete',
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            title: { type: 'string', maxLength: 255 },
            keyword: { type: 'string', maxLength: 200 },
            result_url: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');

      const sets: string[] = [`status = 'DONE'`, `published_at = NOW()`, `error = NULL`];
      const params: unknown[] = [];
      if (req.body.title !== undefined) {
        sets.push('title = ?');
        params.push(req.body.title);
      }
      if (req.body.keyword !== undefined) {
        sets.push('keyword = ?');
        params.push(req.body.keyword);
      }
      if (req.body.result_url !== undefined) {
        sets.push('result_url = ?');
        params.push(req.body.result_url);
      }

      const [result] = await app.db.query<ResultSetHeader>(
        `UPDATE nblog_jobs SET ${sets.join(', ')}
          WHERE id = ? AND status = 'PROCESSING'`,
        [...params, id],
      );
      if (result.affectedRows === 0) {
        return reply.conflict('PROCESSING 상태가 아니거나 존재하지 않습니다.');
      }
      // 옵션: 마지막 사용시각 갱신 — 계정별 최근 활동 표시용
      await app.db.query(
        `UPDATE nwork SET n_lastwork_at = NOW()
           WHERE n_idx = (SELECT n_idx FROM nblog_jobs WHERE id = ?)`,
        [id],
      );
      return { ok: true, id };
    },
  );

  // 워커 — 실패 처리.
  app.patch<{ Params: { id: string }; Body: { error?: string } }>(
    '/:id/fail',
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');
      const errMsg = (req.body?.error ?? '').slice(0, 2000) || null;
      const [result] = await app.db.query<ResultSetHeader>(
        `UPDATE nblog_jobs SET status = 'FAILED', error = ? WHERE id = ?`,
        [errMsg, id],
      );
      if (result.affectedRows === 0) return reply.notFound('예약을 찾을 수 없습니다.');
      return { ok: true, id };
    },
  );
}
