import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, forbidden, notFound, parse } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { collectImages, isEmptyDoc } from '../lib/editor.js';
import { ensureThumbnail } from '../lib/thumbnail.js';
import * as uploads from '../repositories/uploads.js';
import * as boards from '../repositories/boards.js';
import * as posts from '../repositories/posts.js';
import * as shops from '../repositories/shops.js';

const listQuery = z.object({
  boardSlug: z.string().max(40).optional(),
  category: z.string().max(40).optional(),
  region: z.string().max(20).optional(),
  q: z.string().max(50).optional(),
  scope: z.enum(posts.SEARCH_SCOPES as [posts.SearchScope, ...posts.SearchScope[]]).optional(),
  authorId: z.coerce.number().int().positive().optional(),
  shopId: z.coerce.number().int().positive().optional(),
  sort: z.enum(['latest', 'popular']).default('latest'),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(1).max(50).default(15),
});

const dealSchema = z.object({
  model: z.string().trim().min(1).max(60),
  storage: z.string().trim().max(30).default(''),
  carrier: z.enum(['SKT', 'KT', 'LG U+', '알뜰폰']),
  joinType: z.enum(['번호이동', '기기변경', '신규가입']),
  principal: z.number().int().min(0).max(5_000_000),
  plan: z.string().trim().max(100).default(''),
  planMonths: z.number().int().min(0).max(36).default(6),
  addons: z.array(z.string().max(60)).max(10).default([]),
});

const createSchema = z.object({
  boardSlug: z.string().min(1).max(40),
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(200),
  category: z.string().max(40).optional(),
  region: z.string().max(20).optional(),
  /** ProseMirror JSON — 본문 정본 */
  contentJson: z.unknown(),
  deal: dealSchema.optional(),
});

/** 글 수정 — 게시판 이동은 허용하지 않는다 (게시판마다 글쓰기 권한이 다르다) */
const updateSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(200).optional(),
  category: z.string().max(40).nullable().optional(),
  region: z.string().max(20).nullable().optional(),
  contentJson: z.unknown().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

const commentSchema = z.object({
  content: z.string().trim().min(1, '댓글 내용을 입력해주세요.').max(2000),
  parentId: z.number().int().positive().optional(),
});

/** 본인 또는 운영진인지 — 글·댓글 수정/삭제 권한 */
const canEdit = (user: { id: number; role: string }, authorId: number) =>
  user.id === authorId || user.role === '운영진';

export default async function postRoutes(app: FastifyInstance) {
  app.get('/posts', async (request) => {
    const filter = parse(listQuery, request.query);
    const result = await posts.listPosts(filter);
    // 1페이지에서는 공지를 위에 붙여 보여준다
    const notices = filter.page === 1 && filter.boardSlug !== 'notice' ? await posts.listNotices(2) : [];
    return { ...result, notices };
  });

  app.get('/posts/:id', async (request) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), request.params);
    const post = await posts.getPost(id);
    if (!post) throw notFound('글');

    // 자기 글은 조회수를 올리지 않는다 — 글쓴이가 새로고침할 때마다 오르면 의미가 없다
    const me = request.user;
    if (me?.id !== post.authorId) await posts.increaseViews(id);

    const views = me?.id === post.authorId ? post.views : post.views + 1;
    if (!me) return { ...post, views, liked: false, scrapped: false };

    return { ...post, views, ...(await posts.getMyReaction(id, me.id)) };
  });

  app.post('/posts', { preHandler: requireAuth }, async (request, reply) => {
    const input = parse(createSchema, request.body);
    const user = request.user!;

    const board = await boards.getBoard(input.boardSlug);
    if (!board) throw badRequest('없는 게시판입니다.');
    if (board.type === 'news' || board.type === 'spec') {
      throw forbidden('이 게시판은 어드민에서 관리합니다.');
    }
    if (board.sellerOnly && user.role !== '판매자' && user.role !== '운영진') {
      throw forbidden('인증된 판매자만 글을 쓸 수 있는 게시판입니다.');
    }
    if (isEmptyDoc(input.contentJson)) throw badRequest('내용을 입력해주세요.');

    // 시세 글은 글쓴이의 매장으로 자동 연결한다 — 남의 매장 이름으로 올리지 못하게
    let deal;
    if (input.deal) {
      const shop = await shops.getShopByOwner(user.id);
      if (!shop) throw forbidden('매장이 등록된 판매자만 시세를 올릴 수 있습니다.');
      deal = { ...input.deal, shopId: shop.id };
    }

    const id = await posts.createPost({
      boardSlug: input.boardSlug,
      authorId: user.id,
      title: input.title,
      category: input.category ?? null,
      region: input.region ?? null,
      contentJson: input.contentJson,
      deal,
    });

    await attachImages(id, input.contentJson, 'create');
    return reply.code(201).send(await posts.getPost(id));
  });

  app.post('/posts/:id/like', { preHandler: requireAuth }, async (request) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), request.params);
    if (!(await posts.getPost(id))) throw notFound('글');
    return posts.toggleLike(id, request.user!.id);
  });

  /** 수정 화면이 쓸 원본 — 본인·운영진만 */
  app.get('/posts/:id/edit', { preHandler: requireAuth }, async (request) => {
    const { id } = parse(idParam, request.params);
    const post = await posts.getPost(id);
    if (!post) throw notFound('글');
    if (!canEdit(request.user!, post.authorId)) throw forbidden('수정 권한이 없습니다.');
    return post;
  });

  app.patch('/posts/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = parse(idParam, request.params);
    const input = parse(updateSchema, request.body);

    const post = await posts.getPost(id);
    if (!post) throw notFound('글');
    if (!canEdit(request.user!, post.authorId)) throw forbidden('수정 권한이 없습니다.');
    if (input.contentJson !== undefined && isEmptyDoc(input.contentJson)) {
      throw badRequest('내용을 입력해주세요.');
    }

    await posts.updatePost(id, input);
    // 본문을 안 건드린 수정(말머리만 변경 등)이면 이미지 연결은 그대로 둔다
    if (input.contentJson !== undefined) await attachImages(id, input.contentJson, 'update');

    return posts.getPost(id);
  });

  app.delete('/posts/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = parse(idParam, request.params);
    const post = await posts.getPost(id);
    if (!post) throw notFound('글');
    if (!canEdit(request.user!, post.authorId)) throw forbidden('삭제 권한이 없습니다.');

    await posts.softDeletePost(id);
    // 글이 사라졌으니 이미지도 청소 대상으로. 파일 삭제는 뒷정리 작업이 유예 후 처리한다
    await uploads.unlinkUploadsOfPost(id);
    return reply.code(204).send();
  });

  /** 되살리기 — 운영진만. 잘못 지웠거나 신고가 반려됐을 때 */
  app.post('/posts/:id/restore', { preHandler: requireAuth }, async (request) => {
    const { id } = parse(idParam, request.params);
    if (request.user!.role !== '운영진') throw forbidden('운영진만 복구할 수 있습니다.');
    if (!(await posts.restorePost(id))) throw notFound('되살릴 글');
    return { ok: true };
  });

  /**
   * 스크랩 토글.
   *
   * "켜라/꺼라" 가 아니라 토글인 이유 — 화면이 들고 있는 상태와 서버가 어긋나도
   * 한 번 더 누르면 맞춰진다.
   */
  app.post('/posts/:id/scrap', { preHandler: requireAuth }, async (request) => {
    const { id } = parse(idParam, request.params);
    if (!(await posts.getPost(id))) throw notFound('글');
    return posts.toggleScrap(id, request.user!.id);
  });

  /** 내 스크랩 목록 — 본인 것만 본다 */
  app.get('/me/scraps', { preHandler: requireAuth }, async (request) => {
    const { page, size } = parse(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        size: z.coerce.number().int().min(1).max(50).default(20),
      }),
      request.query,
    );
    return posts.listScrappedPosts(request.user!.id, page, size);
  });

  app.get('/posts/:id/comments', async (request) => {
    const { id } = parse(idParam, request.params);
    return { items: await withMyLikes(id, await posts.listComments(id), request.user?.id) };
  });

  app.post('/posts/:id/comments', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), request.params);
    const input = parse(commentSchema, request.body);
    if (!(await posts.getPost(id))) throw notFound('글');

    await posts.createComment({
      postId: id,
      authorId: request.user!.id,
      content: input.content,
      parentId: input.parentId ?? null,
    });
    return reply.code(201).send({ items: await withMyLikes(id, await posts.listComments(id), request.user!.id) });
  });

  app.patch('/comments/:id', { preHandler: requireAuth }, async (request) => {
    const { id } = parse(idParam, request.params);
    const comment = await posts.getComment(id);
    if (!comment) throw notFound('댓글');
    if (!canEdit(request.user!, comment.author_id)) throw forbidden('수정 권한이 없습니다.');

    const { content } = parse(commentSchema.pick({ content: true }), request.body);
    await posts.updateComment(id, content);
    return { items: await withMyLikes(comment.post_id, await posts.listComments(comment.post_id), request.user!.id) };
  });

  app.delete('/comments/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = parse(idParam, request.params);
    const comment = await posts.getComment(id);
    if (!comment) throw notFound('댓글');
    if (!canEdit(request.user!, comment.author_id)) throw forbidden('삭제 권한이 없습니다.');

    await posts.softDeleteComment(id, comment.post_id);
    return reply.code(204).send();
  });

  app.post('/comments/:id/like', { preHandler: requireAuth }, async (request) => {
    const { id } = parse(idParam, request.params);
    const comment = await posts.getComment(id);
    if (!comment) throw notFound('댓글');
    return posts.toggleCommentLike(id, request.user!.id);
  });
}

/**
 * 본문에 실제로 쓰인 이미지만 글에 묶고, 첫 이미지의 썸네일을 준비한다.
 *
 * 본문에서 빠진 이미지는 연결이 끊겨 청소 대상이 된다.
 * 썸네일을 만든 뒤에 글에 저장해야, 저장된 주소가 실제로 있는 파일을 가리킨다.
 */
async function attachImages(postId: number, contentJson: unknown, mode: 'create' | 'update') {
  const images = collectImages(contentJson);

  if (mode === 'create') await uploads.linkUploadsToPost(postId, images);
  else await uploads.relinkUploadsToPost(postId, images);

  const first = images[0];
  if (!first) return;
  const thumb = await ensureThumbnail(first);
  await posts.setThumbUrl(postId, thumb);
}

/** 댓글 목록에 "내가 좋아요 눌렀는지" 를 붙인다 (비로그인이면 그대로) */
async function withMyLikes<T extends { id: number }>(postId: number, items: T[], userId?: number) {
  if (!userId || items.length === 0) return items;
  const liked = new Set(await posts.getMyLikedCommentIds(postId, userId));
  return items.map((c) => ({ ...c, liked: liked.has(c.id) }));
}
