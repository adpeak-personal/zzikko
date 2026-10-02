import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound, parse } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';
import * as boards from '../repositories/boards.js';
import * as shops from '../repositories/shops.js';
import * as posts from '../repositories/posts.js';
import * as users from '../repositories/users.js';
import authRoutes from './auth.js';
import postRoutes from './posts.js';
import contentRoutes from './content.js';
import uploadRoutes from './uploads.js';

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

  await app.register(authRoutes);
  await app.register(postRoutes);
  await app.register(contentRoutes);
  await app.register(uploadRoutes);

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
