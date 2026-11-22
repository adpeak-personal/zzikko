import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { HttpError, notFound, parse } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';
import * as boards from '../repositories/boards.js';
import * as shops from '../repositories/shops.js';
import * as sise from '../repositories/sise.js';
import * as content from '../repositories/content.js';
import { buildPairs, pairSlug } from '../lib/specs/pairs.js';
import * as posts from '../repositories/posts.js';
import * as users from '../repositories/users.js';
import authRoutes from './auth.js';
import postRoutes from './posts.js';
import contentRoutes from './content.js';
import uploadRoutes from './uploads.js';
import nworkRoutes from './nwork.js';
import sellerRoutes from './seller.js';
import siseRoutes from './sise.js';

const boardPatchSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  description: z.string().trim().max(200).optional(),
  type: z.enum(['list', 'deal', 'gallery', 'news', 'spec']).optional(),
  writeMode: z.enum(['editor', 'photo']).optional(),
  categories: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  sellerOnly: z.boolean().optional(),
});

export default async function routes(app: FastifyInstance) {
  app.get('/health', async () => ({ status: 'ok' }));

  /**
   * 사이트맵 재료 — 주소를 만들 수 있는 최소 정보만.
   *
   * 목록 API(/posts)는 쪽으로 나뉘고 지운 글을 거르느라 전부 훑기엔 맞지 않아 따로 둔다.
   */
  app.get('/sitemap', async () => {
    const [postRows, siseRows, boardGroups, specs, newsRows, specRows] = await Promise.all([
      posts.listForSitemap(),
      sise.listPublishedSlugs(),
      boards.listBoardGroups(),
      content.listSpecs(),
      content.listNewsForSitemap(),
      content.listSpecsForSitemap(),
    ]);

    /*
     * 기사·기종은 posts 와 **다른 테이블**이라 posts.listForSitemap 에 안 걸린다.
     * 주소는 게시판을 타므로(/board/news/12) 어느 게시판이 그 종류인지 찾아야 한다 —
     * slug 는 어드민에서 바꿀 수 있으니 'news' 라고 박지 않는다.
     */
    const allBoards = boardGroups.flatMap((group) => group.boards);
    const slugOf = (type: 'news' | 'spec') => allBoards.find((board) => board.type === type)?.slug ?? null;
    const newsSlug = slugOf('news');
    const specSlug = slugOf('spec');

    return {
      posts: postRows,
      sise: siseRows,
      boards: allBoards.map((board) => board.slug),
      // 비교 페이지는 사이트 안에 링크가 적어 사이트맵 비중이 크다
      compare: buildPairs(specs).map((pair) => pairSlug(pair.a, pair.b)),
      news: newsSlug ? newsRows.map((row) => ({ ...row, boardSlug: newsSlug })) : [],
      specs: specSlug ? specRows.map((row) => ({ ...row, boardSlug: specSlug })) : [],
    };
  });

  await app.register(authRoutes);
  await app.register(postRoutes);
  await app.register(contentRoutes);
  await app.register(uploadRoutes);
  await app.register(sellerRoutes);
  await app.register(siseRoutes);
  // 운영진 전용 훅을 플러그인 안에 거므로 다른 라우트에는 번지지 않는다
  await app.register(nworkRoutes);

  /* ── 게시판 ── */

  app.get('/boards', async () => ({ items: await boards.listBoardGroups() }));

  app.get('/boards/:slug', async (request) => {
    const { slug } = parse(z.object({ slug: z.string().max(40) }), request.params);
    const board = await boards.getBoard(slug);
    if (!board) throw notFound('게시판');
    return board;
  });

  app.patch('/admin/boards/:slug', { preHandler: requireAdmin }, async (request) => {
    const { slug } = parse(z.object({ slug: z.string().max(40) }), request.params);
    if (!(await boards.getBoard(slug))) throw notFound('게시판');
    await boards.updateBoard(slug, parse(boardPatchSchema, request.body));
    return boards.getBoard(slug);
  });

  /**
   * 게시판 추가. 형식은 회원 글 게시판(list/deal/gallery)만 고를 수 있다 —
   * news·spec 은 사이트맵·기사 주소가 "그 형식 게시판은 하나"라고 보고 찾기 때문이다.
   */
  app.post('/admin/boards', { preHandler: requireAdmin }, async (request, reply) => {
    const input = parse(
      z.object({
        groupId: z.number().int().positive(),
        slug: z
          .string()
          .trim()
          .toLowerCase()
          .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, '주소는 영문 소문자·숫자·하이픈 2~40자로 적어주세요.'),
        name: z.string().trim().min(1).max(40),
        description: z.string().trim().max(200).default(''),
        type: z.enum(['list', 'deal', 'gallery']).default('list'),
        writeMode: z.enum(['editor', 'photo']).default('editor'),
      }),
      request.body,
    );
    const result = await boards.createBoard(input);
    if (!result.ok) {
      if (result.reason === 'no-group') throw notFound('대분류');
      throw new HttpError(409, `이미 쓰고 있는 주소입니다: /board/${input.slug}`);
    }
    reply.code(201);
    return result.board;
  });

  /** 대분류(공지&안내 · 휴대폰 …) 이름 바꾸기 */
  app.patch('/admin/board-groups/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), request.params);
    const { name } = parse(z.object({ name: z.string().trim().min(1).max(30) }), request.body);
    if (!(await boards.renameBoardGroup(id, name))) throw notFound('대분류');
    return { id, name };
  });

  /* ── 판매자 매장 ── */

  app.get('/shops', async () => ({ items: await shops.listShops() }));

  app.get('/shops/:slug', async (request) => {
    const { slug } = parse(z.object({ slug: z.string().max(60) }), request.params);
    const shop = await shops.getShopBySlug(slug);
    if (!shop) throw notFound('매장');
    const { items } = await posts.listPosts({ shopId: shop.id, size: 50 });
    return { shop, posts: items };
  });

  /* ── 어드민 대시보드 ── */

  app.get('/admin/stats', { preHandler: requireAdmin }, async () => {
    const [byBoard, recentUsers, userCount, recentUserCount, recent] = await Promise.all([
      boards.countPostsByBoard(),
      users.listRecentUsers(6),
      users.countUsers(),
      users.countRecentUsers(7),
      posts.listPosts({ size: 8 }),
    ]);

    return {
      totals: { users: userCount, posts: recent.total, shops: (await shops.listShops()).length },
      recent7d: { users: recentUserCount },
      byBoard: byBoard.map((row) => ({ slug: row.slug, name: row.name, type: row.type, postCount: row.post_count })),
      recentPosts: recent.items,
      recentUsers,
    };
  });
}
