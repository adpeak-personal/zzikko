// 블로그 예약 작업 저장 라우트
//
// 어드민 ─ 등록
//   POST   /api/blog-jobs/bulk           Body: { items: [{title, scheduled_at, keywords?}] }
//
// 워커(파이썬) ─ 큐 처리
//   GET    /api/blog-jobs/due            현재 시각 기준 due 인 PENDING 작업 1건
//   PATCH  /api/blog-jobs/:id/claim      PENDING → PROCESSING (원자적 선점)
//   PATCH  /api/blog-jobs/:id/complete   글 본문을 받아 posts 에 저장 + 작업 DONE
//   PATCH  /api/blog-jobs/:id/fail       FAILED + error 메모

import type { FastifyInstance } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { finalizeTmpUrls, generateThumbnail } from '../lib/gcs';
import { pickRandomAlias } from '../lib/alias';

interface TitleRow extends RowDataPacket {
  title: string;
}

interface JobRow extends RowDataPacket {
  id: number;
  title: string;
  keywords: string | null;
  scheduled_at: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  result_url: string | null;
  error: string | null;
  created_at: string;
}

interface KeywordRow extends RowDataPacket {
  keyword: string;
}

// "강남 휴대폰 성지,갤럭시S26" → ["강남 휴대폰 성지", "갤럭시S26"]
function parseKeywordsCsv(csv: string | null): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const DEDUPE_WINDOW_DAYS = 20;
const MAX_ITEMS = 200;

// AI 자동 발행 글이 들어갈 게시판 slug. 다른 카테고리와 같은 선상에서 노출되지만,
// 메인 네비게이션에서는 hiddenFromNav 처리되어 찾기 어렵게 둠.
const AI_BLOG_SLUG = 'blog';

// AI 가 발행한 글의 작성자(어드민 계정). 다른 계정으로 바꾸려면 .env 의 AI_BLOG_AUTHOR_ID 설정.
const AI_BLOG_AUTHOR_ID = Number(process.env.AI_BLOG_AUTHOR_ID || 13);

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
          // 디노멀라이즈된 keywords 컬럼 — 콤마구분 문자열
          const keywordsCsv = item.keywords.length > 0 ? item.keywords.join(',') : null;
          const [jobResult] = await conn.query<ResultSetHeader>(
            `INSERT INTO blog_jobs (title, keywords, scheduled_at) VALUES (?, ?, ?)`,
            [item.title, keywordsCsv, item.scheduled_at],
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

  // ───────────────────────────────────────────────────────────────────
  // 어드민 ─ 목록 / 삭제 (JobBoard 가 사용)
  // ───────────────────────────────────────────────────────────────────

  // GET /api/blog-jobs?status=&page=&limit=
  //   필터: status (없으면 전체)
  //   정렬: scheduled_at DESC, id DESC
  //   응답: items[], total, counts(상태별)
  app.get<{
    Querystring: { status?: string; page?: string; limit?: string };
  }>('/', async (req, reply) => {
    const { status } = req.query;
    const VALID = ['PENDING', 'PROCESSING', 'DONE', 'FAILED'];
    if (status && !VALID.includes(status)) {
      return reply.badRequest('유효하지 않은 status 입니다.');
    }
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 100)));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [rows] = await app.db.query<JobRow[]>(
      `SELECT id, title, keywords, scheduled_at, status, result_url, error,
              published_at, created_at, updated_at
         FROM blog_jobs
         ${whereSql}
         ORDER BY scheduled_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    const [countRows] = await app.db.query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) AS total FROM blog_jobs ${whereSql}`,
      params,
    );

    // 상태별 카운트는 필터와 무관하게 전체 기준 (상단 카드용)
    const [statusRows] = await app.db.query<(RowDataPacket & { status: string; n: number })[]>(
      `SELECT status, COUNT(*) AS n FROM blog_jobs GROUP BY status`,
    );
    const counts: Record<string, number> = { PENDING: 0, PROCESSING: 0, DONE: 0, FAILED: 0 };
    for (const r of statusRows) counts[r.status] = Number(r.n);

    return {
      items: rows,
      total: Number(countRows[0]?.total ?? 0),
      page,
      limit,
      counts,
    };
  });

  // DELETE /api/blog-jobs/:id
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');

    const [result] = await app.db.query<ResultSetHeader>(
      `DELETE FROM blog_jobs WHERE id = ?`,
      [id],
    );
    if (result.affectedRows === 0) return reply.notFound('작업을 찾을 수 없습니다.');
    return { ok: true, deleted: result.affectedRows };
  });

  // DELETE /api/blog-jobs?status=DONE  또는 ?all=1
  //   - 완료 정리 / 전체 삭제 버튼이 사용
  //   - all=1 이면 status 무시하고 전체
  app.delete<{ Querystring: { status?: string; all?: string } }>(
    '/',
    async (req, reply) => {
      const all = req.query.all === '1' || req.query.all === 'true';
      const status = req.query.status;
      const VALID = ['PENDING', 'PROCESSING', 'DONE', 'FAILED'];

      let sql: string;
      let params: unknown[];
      if (all) {
        sql = `DELETE FROM blog_jobs`;
        params = [];
      } else if (status && VALID.includes(status)) {
        sql = `DELETE FROM blog_jobs WHERE status = ?`;
        params = [status];
      } else {
        return reply.badRequest('status 또는 all=1 이 필요합니다.');
      }

      const [result] = await app.db.query<ResultSetHeader>(sql, params);
      return { ok: true, deleted: result.affectedRows };
    },
  );

  // ───────────────────────────────────────────────────────────────────
  // 워커용 라우트들 — 파이썬 it_blog 가 호출
  // ───────────────────────────────────────────────────────────────────

  // GET /api/blog-jobs/due
  //   scheduled_at <= NOW() & status='PENDING' 중 가장 이른 1건 + 키워드 동봉.
  //   없으면 { job: null }
  app.get('/due', async (_req) => {
    const [rows] = await app.db.query<JobRow[]>(
      `SELECT id, title, keywords, scheduled_at, status, result_url, error, created_at
         FROM blog_jobs
        WHERE status = 'PENDING' AND scheduled_at <= NOW()
        ORDER BY scheduled_at ASC, id ASC
        LIMIT 1`,
    );
    const job = rows[0];
    if (!job) return { job: null };

    // 1순위: blog_jobs.keywords (csv) — 수동 INSERT 한 row 도 동작
    // 2순위: blog_job_keywords 테이블 (혹시 csv 가 비어있는 구버전 row 대응)
    let keywords = parseKeywordsCsv(job.keywords);
    if (keywords.length === 0) {
      const [kwRows] = await app.db.query<KeywordRow[]>(
        `SELECT keyword FROM blog_job_keywords WHERE job_id = ? ORDER BY id ASC`,
        [job.id],
      );
      keywords = kwRows.map((r) => r.keyword);
    }
    return { job: { ...job, keywords } };
  });

  // PATCH /api/blog-jobs/:id/claim
  //   PENDING → PROCESSING 로 원자적 전환 (다른 워커가 가져가지 못하게).
  //   이미 다른 상태면 409 — 워커는 이 응답 보면 다음 due 로 넘어가면 됨.
  app.patch<{ Params: { id: string } }>('/:id/claim', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');

    const [result] = await app.db.query<ResultSetHeader>(
      `UPDATE blog_jobs SET status = 'PROCESSING'
         WHERE id = ? AND status = 'PENDING'`,
      [id],
    );
    if (result.affectedRows === 0) {
      return reply.conflict('이미 다른 워커가 처리 중이거나 상태가 PENDING 이 아닙니다.');
    }
    return { ok: true, id };
  });

  // PATCH /api/blog-jobs/:id/complete
  //   Body: { content, thumbnail_url? }
  //   1) 본문의 tmp/* 이미지를 blog/* 로 영구 이동 + URL 치환
  //   2) 본문 첫 이미지로 썸네일 생성 (blog/{date}/thumb_*.webp)
  //   3) posts 테이블에 board_slug='blog', user_id=AI_BLOG_AUTHOR_ID 로 INSERT
  //   4) blog_jobs.status='DONE', result_url='/posts/blog/{post_id}', published_at=NOW()
  //   3~4 는 트랜잭션으로 묶음 (1~2 는 GCS 작업이라 트랜잭션 밖).
  app.patch<{
    Params: { id: string };
    Body: { content: string; thumbnail_url?: string };
  }>(
    '/:id/complete',
    {
      schema: {
        body: {
          type: 'object',
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1 },
            thumbnail_url: { type: 'string' },
          },
        },
      },
    },
    async (req, reply) => {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');

      const { content, thumbnail_url } = req.body;

      // 작업 정보 (제목) 가져오기 — PROCESSING 상태인지 검증도 같이
      const [jobRows] = await app.db.query<JobRow[]>(
        `SELECT id, title, status FROM blog_jobs WHERE id = ?`,
        [id],
      );
      const job = jobRows[0];
      if (!job) return reply.notFound('작업을 찾을 수 없습니다.');
      if (job.status !== 'PROCESSING') {
        return reply.conflict(`현재 상태가 PROCESSING 이 아닙니다. (status=${job.status})`);
      }

      // 본문의 tmp/ 이미지를 blog/ 로 영구 이동 + URL 치환 (lifecycle 자동삭제 방지)
      // 썸네일: 본문 첫 이미지로 생성(서버측 리사이즈). 실패하면 클라가 보낸 thumbnail_url 사용.
      const finalContent = await finalizeTmpUrls(content, AI_BLOG_SLUG);
      const finalThumb =
        (await generateThumbnail(finalContent, AI_BLOG_SLUG)) ??
        (thumbnail_url ?? null);

      const conn = await app.db.getConnection();
      try {
        await conn.beginTransaction();

        // posts INSERT — 어드민 계정으로 작성하되, alias 풀에서 랜덤 닉으로 stamp.
        // alias 가 없으면 NULL → users.nickname 으로 표시.
        const displayNickname = await pickRandomAlias(app, AI_BLOG_AUTHOR_ID);
        const [postResult] = await conn.query<ResultSetHeader>(
          `INSERT INTO posts (board_slug, user_id, display_nickname, title, content, thumbnail_url)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [AI_BLOG_SLUG, AI_BLOG_AUTHOR_ID, displayNickname, job.title, finalContent, finalThumb],
        );
        const postId = postResult.insertId;

        const resultUrl = `/posts/${AI_BLOG_SLUG}/${postId}`;
        await conn.query(
          `UPDATE blog_jobs
              SET status = 'DONE',
                  result_url = ?,
                  published_at = NOW(),
                  error = NULL
            WHERE id = ?`,
          [resultUrl, id],
        );

        await conn.commit();
        return { ok: true, job_id: id, post_id: postId, result_url: resultUrl };
      } catch (err) {
        await conn.rollback();
        app.log.error({ err, jobId: id }, 'blog-jobs/complete 실패');
        return reply.internalServerError('완료 처리 중 오류가 발생했습니다.');
      } finally {
        conn.release();
      }
    },
  );

  // PATCH /api/blog-jobs/:id/fail
  //   Body: { error }
  //   상태가 어떻든 FAILED 로 기록 (워커가 에러 떨어진 경우)
  app.patch<{
    Params: { id: string };
    Body: { error?: string };
  }>('/:id/fail', async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return reply.badRequest('잘못된 id');

    const errMsg = (req.body?.error ?? '').slice(0, 2000) || null;

    const [result] = await app.db.query<ResultSetHeader>(
      `UPDATE blog_jobs SET status = 'FAILED', error = ? WHERE id = ?`,
      [errMsg, id],
    );
    if (result.affectedRows === 0) return reply.notFound('작업을 찾을 수 없습니다.');
    return { ok: true, id };
  });

  // 공개 목록/상세는 표준 /api/posts/load_lists?board_slug=blog 와
  // /api/posts/detail/:id 가 그대로 처리한다.
}
