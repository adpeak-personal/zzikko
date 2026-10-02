import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, forbidden, notFound, parse } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { isEmptyDoc } from '../lib/editor.js';
import * as boards from '../repositories/boards.js';
import * as posts from '../repositories/posts.js';
import * as shops from '../repositories/shops.js';

const listQuery = z.object({
  boardSlug: z.string().max(40).optional(),
  category: z.string().max(40).optional(),
  region: z.string().max(20).optional(),
  q: z.string().max(50).optional(),
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

const commentSchema = z.object({
  content: z.string().trim().min(1, '댓글 내용을 입력해주세요.').max(2000),
  parentId: z.number().int().positive().optional(),
});

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

    await posts.increaseViews(id);
    return { ...post, views: post.views + 1 };
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

    return reply.code(201).send(await posts.getPost(id));
  });

  app.post('/posts/:id/like', { preHandler: requireAuth }, async (request) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), request.params);
    if (!(await posts.getPost(id))) throw notFound('글');
    return posts.toggleLike(id, request.user!.id);
  });

  app.get('/posts/:id/comments', async (request) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), request.params);
    return { items: await posts.listComments(id) };
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
    return reply.code(201).send({ items: await posts.listComments(id) });
  });
}
