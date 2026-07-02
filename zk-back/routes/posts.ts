import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader } from 'mysql2';
import {
  finalizeTmpUrls,
  deleteStoredImages,
  generateThumbnail,
  makeThumbFromUrl,
  toDisplayUrl,
  stripBaseInText,
  expandBaseInHtml,
  expandExtraData,
} from '../lib/gcs';
import { pickRandomAlias } from '../lib/alias';

export default async function postRoutes(app: FastifyInstance) {
  // POST /api/posts  — 게시글 작성 (인증 필요)
  app.post<{ Body: { board_slug: string; sub_slug?: string; title: string; content: string; thumbnail_url?: string; extra_data?: object } }>(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['board_slug', 'title', 'content'],
          properties: {
            board_slug:    { type: 'string', minLength: 1 },
            sub_slug:      { type: 'string', minLength: 1, maxLength: 50 },
            title:         { type: 'string', minLength: 1 },
            content:       { type: 'string', minLength: 1 },
            thumbnail_url: { type: 'string' },
            extra_data:    { type: 'object' },
          },
        },
      },
    },
    async (req) => {
      const { board_slug, sub_slug, title, content, thumbnail_url, extra_data } = req.body;
      // 본문/썸네일의 tmp/ 이미지를 게시판 slug 폴더로 확정 이동 + URL 을 상대경로로 통일.
      // finalizeTmpUrls 는 결과를 항상 상대경로로 정규화해서 반환 (풀 URL 제거).
      const finalContent = await finalizeTmpUrls(content, board_slug);
      // 썸네일 우선순위:
      //   1) 클라이언트가 thumbnail_url 을 명시 (파이썬 워커/스크래퍼 등이 미리 만든 경우)
      //      - 우리 버킷 → 상대경로로 스트립 후 그대로 사용 (중복 리사이즈 생략).
      //      - 외부 URL → 다운로드해서 GCS 썸으로 재생성. raw 외부 URL 은 절대 DB 로 안 새어감.
      //   2) 없으면 본문 첫 이미지로 auto 생성 (에디터에서 안 넘긴 경우 등).
      let finalThumb: string | null = null;
      if (thumbnail_url) {
        const finalizedThumb = await finalizeTmpUrls(thumbnail_url, board_slug);
        if (finalizedThumb.startsWith('/')) {
          finalThumb = finalizedThumb;
        } else {
          finalThumb = await makeThumbFromUrl(finalizedThumb, board_slug);
        }
      }
      if (!finalThumb) {
        finalThumb = await generateThumbnail(finalContent, board_slug);
      }
      // extra_data 안에 남을 수 있는 우리 버킷 풀 URL 도 스트립하여 저장.
      const finalExtraJson = extra_data
        ? stripBaseInText(JSON.stringify(extra_data))
        : null;
      // 작성자에게 등록된 활성 alias 가 있으면 그 중 랜덤 하나로 display_nickname 을 stamp.
      // 없으면 NULL → 글 표시 시 users.nickname 으로 폴백.
      const displayNickname = await pickRandomAlias(app, req.user.sub);

      const [result] = await app.db.query<ResultSetHeader>(
        `INSERT INTO posts (board_slug, sub_slug, user_id, display_nickname, title, content, thumbnail_url, extra_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [board_slug, sub_slug ?? null, req.user.sub, displayNickname, title, finalContent, finalThumb, finalExtraJson],
      );
      return { id: result.insertId };
    },
  );

  // GET /api/posts/detail/:id
  app.get('/detail/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const postId = parseInt(id);
    if (isNaN(postId)) return reply.badRequest('잘못된 게시글 ID입니다.');

    const [postRows] = await app.db.query(
      `SELECT p.id, p.board_slug, p.sub_slug, p.user_id, p.title, p.content, p.thumbnail_url, p.extra_data,
              p.view_count, p.like_count, p.comment_count, p.is_notice, p.created_at,
              COALESCE(p.display_nickname, u.nickname) AS author,
              u.profile_image AS author_profile_image, up.level
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       LEFT JOIN user_profile up ON u.id = up.user_id
       WHERE p.id = ? AND p.status = 'ACTIVE'`,
      [postId],
    ) as any;

    const post = (postRows as any[])[0];
    if (!post) return reply.notFound('게시글을 찾을 수 없습니다.');

    await app.db.query('UPDATE posts SET view_count = view_count + 1 WHERE id = ?', [postId]);

    const [comments] = await app.db.query(
      `SELECT c.id, c.parent_id, c.content, c.like_count, c.created_at,
              u.nickname AS author, u.profile_image AS author_profile_image
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ? AND c.status = 'ACTIVE'
       ORDER BY COALESCE(c.parent_id, c.id), c.created_at ASC`,
      [postId],
    ) as any;

    const [prevRows] = await app.db.query(
      `SELECT id FROM posts WHERE board_slug = ? AND status = 'ACTIVE' AND id < ? ORDER BY id DESC LIMIT 1`,
      [post.board_slug, postId],
    ) as any;

    const [nextRows] = await app.db.query(
      `SELECT id FROM posts WHERE board_slug = ? AND status = 'ACTIVE' AND id > ? ORDER BY id ASC LIMIT 1`,
      [post.board_slug, postId],
    ) as any;

    // 응답 조립 — DB 는 상대경로("/…"), 응답은 풀 URL 로 재조립.
    return {
      ...post,
      content: expandBaseInHtml(post.content),
      thumbnail_url: toDisplayUrl(post.thumbnail_url),
      extra_data: expandExtraData(post.extra_data),
      comments,
      prev_id: (prevRows as any[])[0]?.id ?? null,
      next_id: (nextRows as any[])[0]?.id ?? null,
    };
  });

  // GET /api/posts/load_lists?board_slug=...&sub_slug=...
  app.get('/load_lists', async (req, _reply) => {

    const { board_slug, sub_slug, page = '1', limit = '20' } = req.query as {
      board_slug?: string;
      sub_slug?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // 동적 WHERE 빌드 — board_slug / sub_slug 조합 지원
    const conds: string[] = ['p.status = "ACTIVE"'];
    const baseParams: unknown[] = [];
    if (board_slug) {
      conds.push('p.board_slug = ?');
      baseParams.push(board_slug);
    }
    if (sub_slug) {
      conds.push('p.sub_slug = ?');
      baseParams.push(sub_slug);
    }
    const whereSql = `WHERE ${conds.join(' AND ')}`;

    const [rows] = await app.db.query(
      `SELECT
        p.id,
        p.board_slug,
        p.sub_slug,
        p.title,
        p.thumbnail_url AS thumb,
        p.view_count   AS views,
        p.like_count,
        p.comment_count,
        p.is_notice,
        p.extra_data,
        p.created_at,
        COALESCE(p.display_nickname, u.nickname) AS author,
        up.level
      FROM posts p
      LEFT JOIN users u  ON p.user_id = u.id
      LEFT JOIN user_profile up ON u.id = up.user_id
      ${whereSql}
      ORDER BY p.is_notice DESC, p.created_at DESC
      LIMIT ? OFFSET ?`,
      [...baseParams, limitNum, offset],
    );

    const [[{ total }]] = await app.db.query(
      `SELECT COUNT(*) AS total FROM posts p ${whereSql}`,
      baseParams,
    ) as any;

    // 목록 응답에서도 썸네일/extra_data 재조립.
    const data = (rows as any[]).map((r) => ({
      ...r,
      thumb: toDisplayUrl(r.thumb),
      extra_data: expandExtraData(r.extra_data),
    }));

    return {
      data,
      meta: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    };
  });

  // GET /api/posts/sitemap
  //   sitemap.xml 생성용 라이트 페이로드. 인증 불필요, 최근 5000개 활성 글.
  //   프론트 sitemap.ts 가 5분 캐싱해서 호출한다.
  app.get('/sitemap', async (_req, reply) => {
    const [rows] = await app.db.query(
      `SELECT id, board_slug, updated_at
         FROM posts
        WHERE status = 'ACTIVE'
        ORDER BY updated_at DESC
        LIMIT 5000`,
    ) as any;
    // CDN/브라우저 캐시 힌트 — 5분 fresh, 실패 시 하루까지 stale 허용
    reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    return { data: rows };
  });

  // GET /api/posts/rss?limit=50
  //   RSS/Atom 피드 생성용. 인증 불필요, 최신 순.
  //   본문은 HTML 태그 제거 후 앞 500자만 반환(피드 excerpt 용).
  app.get<{ Querystring: { limit?: string } }>('/rss', async (req, reply) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit ?? '50', 10) || 50));
    const [rows] = await app.db.query(
      `SELECT p.id, p.board_slug, p.sub_slug, p.title, p.content, p.thumbnail_url,
              p.created_at, p.updated_at,
              COALESCE(p.display_nickname, u.nickname) AS author
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
        WHERE p.status = 'ACTIVE'
        ORDER BY p.created_at DESC
        LIMIT ?`,
      [limit],
    ) as any;

    const items = (rows as any[]).map((r) => {
      // HTML 태그 제거 + 공백 정리 → 앞 500자
      const excerpt = String(r.content ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500);
      return {
        id: r.id,
        board_slug: r.board_slug,
        sub_slug: r.sub_slug,
        title: r.title,
        thumbnail_url: toDisplayUrl(r.thumbnail_url),
        excerpt,
        author: r.author,
        created_at: r.created_at,
        updated_at: r.updated_at,
      };
    });

    reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400');
    return { data: items };
  });

  // DELETE /api/posts/:id — 게시글 삭제 (작성자 본인만, DB + GCS 이미지 전부 삭제)
  app.delete('/:id', { preHandler: app.authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const postId = parseInt(id);
    if (isNaN(postId)) return reply.badRequest('잘못된 게시글 ID입니다.');

    const [rows] = await app.db.query(
      'SELECT user_id, content, thumbnail_url, extra_data FROM posts WHERE id = ?',
      [postId],
    ) as any;
    const post = (rows as any[])[0];
    if (!post) return reply.notFound('게시글을 찾을 수 없습니다.');

    // 작성자 본인(또는 관리자)만 삭제 가능
    const isOwner = post.user_id === req.user.sub;
    const isAdmin = req.user.role === 'ADMIN';
    if (!isOwner && !isAdmin) return reply.forbidden('본인 글만 삭제할 수 있습니다.');

    // 본문 + 썸네일 + extra_data 안의 GCS 이미지 전부 삭제 (풀 URL/상대경로 둘 다 매칭)
    const extraText = post.extra_data ? JSON.stringify(post.extra_data) : null;
    await deleteStoredImages(post.content, post.thumbnail_url, extraText);

    // DB 삭제 (comments·post_likes 는 ON DELETE CASCADE 로 함께 삭제됨)
    await app.db.query('DELETE FROM posts WHERE id = ?', [postId]);

    return { ok: true };
  });
}
