import type { FastifyInstance } from 'fastify';
import type { ResultSetHeader } from 'mysql2';
import { finalizeTmpUrls, deleteStoredImages, generateThumbnail } from '../lib/gcs';

export default async function postRoutes(app: FastifyInstance) {
  // POST /api/posts  — 게시글 작성 (인증 필요)
  app.post<{ Body: { board_slug: string; title: string; content: string; thumbnail_url?: string; extra_data?: object } }>(
    '/',
    {
      preHandler: app.authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['board_slug', 'title', 'content'],
          properties: {
            board_slug:    { type: 'string', minLength: 1 },
            title:         { type: 'string', minLength: 1 },
            content:       { type: 'string', minLength: 1 },
            thumbnail_url: { type: 'string' },
            extra_data:    { type: 'object' },
          },
        },
      },
    },
    async (req) => {
      const { board_slug, title, content, thumbnail_url, extra_data } = req.body;
      // 본문/썸네일의 tmp/ 이미지를 posts/ 로 확정 이동 + URL 치환 (고아 파일 방지)
      const finalContent = await finalizeTmpUrls(content);
      // 썸네일: 본문 첫 이미지로 생성 → 없으면 전달된 thumbnail_url → 그것도 없으면 null
      const finalThumb =
        (await generateThumbnail(finalContent)) ??
        (thumbnail_url ? await finalizeTmpUrls(thumbnail_url) : null);
      const [result] = await app.db.query<ResultSetHeader>(
        `INSERT INTO posts (board_slug, user_id, title, content, thumbnail_url, extra_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [board_slug, req.user.sub, title, finalContent, finalThumb, extra_data ? JSON.stringify(extra_data) : null],
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
      `SELECT p.id, p.board_slug, p.user_id, p.title, p.content, p.thumbnail_url, p.extra_data,
              p.view_count, p.like_count, p.comment_count, p.is_notice, p.created_at,
              u.nickname AS author, u.profile_image AS author_profile_image, up.level
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

    return {
      ...post,
      comments,
      prev_id: (prevRows as any[])[0]?.id ?? null,
      next_id: (nextRows as any[])[0]?.id ?? null,
    };
  });

  // GET /api/posts/load_lists
  app.get('/load_lists', async (req, _reply) => {

    const { board_slug, page = '1', limit = '20' } = req.query as {
      board_slug?: string;
      page?: string;
      limit?: string;
    };

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = board_slug ? 'WHERE p.board_slug = ? AND p.status = "ACTIVE"' : 'WHERE p.status = "ACTIVE"';
    const params = board_slug ? [board_slug, limitNum, offset] : [limitNum, offset];

    const [rows] = await app.db.query(
      `SELECT
        p.id,
        p.board_slug,
        p.title,
        p.thumbnail_url AS thumb,
        p.view_count   AS views,
        p.like_count,
        p.comment_count,
        p.is_notice,
        p.extra_data,
        p.created_at,
        u.nickname     AS author,
        up.level
      FROM posts p
      LEFT JOIN users u  ON p.user_id = u.id
      LEFT JOIN user_profile up ON u.id = up.user_id
      ${where}
      ORDER BY p.is_notice DESC, p.created_at DESC
      LIMIT ? OFFSET ?`,
      params,
    );

    const [[{ total }]] = await app.db.query(
      `SELECT COUNT(*) AS total FROM posts p ${where.replace('LIMIT ? OFFSET ?', '')}`,
      board_slug ? [board_slug] : [],
    ) as any;

    return {
      data: rows,
      meta: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    };
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

    // 본문 + 썸네일 + extra_data 안의 GCS 이미지 전부 삭제
    const extraText = post.extra_data ? JSON.stringify(post.extra_data) : null;
    await deleteStoredImages(post.content, post.thumbnail_url, extraText);

    // DB 삭제 (comments·post_likes 는 ON DELETE CASCADE 로 함께 삭제됨)
    await app.db.query('DELETE FROM posts WHERE id = ?', [postId]);

    return { ok: true };
  });
}
