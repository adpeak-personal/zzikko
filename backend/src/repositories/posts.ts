import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne, withTransaction } from '../db/pool.js';
import { findFirstImage, toPlainText } from '../lib/editor.js';
import type { Comment, DealInfo, Paged, Post, PublicUser } from '../types.js';

/** 게시글 한 줄 + 조인해 온 작성자·시세 정보 */
interface PostRow extends RowDataPacket {
  id: number;
  board_slug: string;
  category: string | null;
  region: string | null;
  title: string;
  content_json: unknown | null;
  content_text: string;
  thumb_url: string | null;
  author_id: number;
  is_notice: number;
  views: number;
  likes: number;
  comment_count: number;
  created_at: string;
  nickname: string;
  avatar_color: string;
  level: string;
  role: string;
  user_region: string;
  shop_id: number | null;
  bio: string | null;
  joined_at: string;
  deal_shop_id: number | null;
  model: string | null;
  storage: string | null;
  carrier: string | null;
  join_type: string | null;
  principal: number | null;
  plan: string | null;
  plan_months: number | null;
  addons: string[] | null;
}

const SELECT_POST = `
  SELECT p.id, b.slug AS board_slug, p.category, p.region, p.title, p.content_json, p.content_text,
         p.thumb_url, p.author_id, p.is_notice, p.views, p.likes, p.comment_count, p.created_at,
         u.nickname, u.avatar_color, u.level, u.role, u.region AS user_region, u.shop_id, u.bio, u.joined_at,
         d.shop_id AS deal_shop_id, d.model, d.storage, d.carrier, d.join_type,
         d.principal, d.plan, d.plan_months, d.addons
    FROM posts p
    JOIN boards b ON b.id = p.board_id
    JOIN users  u ON u.id = p.author_id
    LEFT JOIN post_deals d ON d.post_id = p.id
`;

function toAuthor(row: PostRow): PublicUser {
  return {
    id: row.author_id,
    nickname: row.nickname,
    avatarColor: row.avatar_color,
    level: row.level as PublicUser['level'],
    role: row.role as PublicUser['role'],
    region: row.user_region as PublicUser['region'],
    shopId: row.shop_id,
    bio: row.bio,
    joinedAt: row.joined_at,
  };
}

function toPost(row: PostRow): Post {
  const deal: DealInfo | undefined =
    row.deal_shop_id && row.model
      ? {
          shopId: row.deal_shop_id,
          model: row.model,
          storage: row.storage ?? '',
          carrier: row.carrier as DealInfo['carrier'],
          joinType: row.join_type as DealInfo['joinType'],
          principal: row.principal ?? 0,
          plan: row.plan ?? '',
          planMonths: row.plan_months ?? 6,
          // JSON 컬럼은 드라이버가 이미 파싱해서 돌려준다
          addons: Array.isArray(row.addons) ? row.addons : [],
        }
      : undefined;

  return {
    id: row.id,
    boardSlug: row.board_slug,
    category: row.category,
    region: row.region as Post['region'],
    title: row.title,
    contentJson: row.content_json,
    content: row.content_text,
    thumbUrl: row.thumb_url,
    authorId: row.author_id,
    author: toAuthor(row),
    isNotice: Boolean(row.is_notice),
    hasImage: Boolean(row.thumb_url),
    views: row.views,
    likes: row.likes,
    commentCount: row.comment_count,
    createdAt: row.created_at,
    ...(deal ? { deal } : {}),
  };
}

export interface PostQuery {
  boardSlug?: string;
  category?: string;
  region?: string;
  q?: string;
  authorId?: number;
  shopId?: number;
  sort?: 'latest' | 'popular';
  page?: number;
  size?: number;
}

/** 목록 — 공지는 제외하고 내려준다 (공지는 listNotices 로 따로 가져간다) */
export async function listPosts(filter: PostQuery): Promise<Paged<Post>> {
  const { boardSlug, category, region, q, authorId, shopId, sort = 'latest', page = 1, size = 15 } = filter;

  const where: string[] = ['p.is_notice = 0'];
  const params: unknown[] = [];

  if (boardSlug) {
    where.push('b.slug = ?');
    params.push(boardSlug);
  }
  if (category) {
    where.push('p.category = ?');
    params.push(category);
  }
  if (region) {
    where.push('p.region = ?');
    params.push(region);
  }
  if (authorId) {
    where.push('p.author_id = ?');
    params.push(authorId);
  }
  if (shopId) {
    where.push('d.shop_id = ?');
    params.push(shopId);
  }
  if (q) {
    // 짧은 검색어도 걸리도록 LIKE 로 찾는다 (글이 많아지면 FULLTEXT 로 바꾼다)
    where.push('(p.title LIKE ? OR p.content_text LIKE ? OR u.nickname LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const orderSql = sort === 'popular' ? 'ORDER BY p.views DESC, p.likes DESC' : 'ORDER BY p.created_at DESC';

  const countRow = await queryOne<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total
       FROM posts p
       JOIN boards b ON b.id = p.board_id
       JOIN users u ON u.id = p.author_id
       LEFT JOIN post_deals d ON d.post_id = p.id
       ${whereSql}`,
    params,
  );

  const rows = await query<PostRow>(`${SELECT_POST} ${whereSql} ${orderSql} LIMIT ? OFFSET ?`, [
    ...params,
    size,
    (page - 1) * size,
  ]);

  return { items: rows.map(toPost), total: countRow?.total ?? 0, page, size };
}

export async function listNotices(limit = 2): Promise<Post[]> {
  const rows = await query<PostRow>(`${SELECT_POST} WHERE p.is_notice = 1 ORDER BY p.created_at DESC LIMIT ?`, [limit]);
  return rows.map(toPost);
}

export async function getPost(id: number): Promise<Post | null> {
  const row = await queryOne<PostRow>(`${SELECT_POST} WHERE p.id = ?`, [id]);
  return row ? toPost(row) : null;
}

/** 상세를 열 때 조회수 +1 */
export async function increaseViews(id: number) {
  await execute('UPDATE posts SET views = views + 1 WHERE id = ?', [id]);
}

export interface NewPost {
  boardSlug: string;
  authorId: number;
  title: string;
  category?: string | null;
  region?: string | null;
  contentJson: unknown;
  deal?: Omit<DealInfo, 'shopId'> & { shopId: number };
}

export async function createPost(input: NewPost): Promise<number> {
  const board = await queryOne<RowDataPacket & { id: number }>('SELECT id FROM boards WHERE slug = ?', [input.boardSlug]);
  if (!board) throw new Error(`게시판을 찾을 수 없습니다: ${input.boardSlug}`);

  const text = toPlainText(input.contentJson);
  const thumb = findFirstImage(input.contentJson);

  return withTransaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO posts (board_id, author_id, category, region, title, content_json, content_text, thumb_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        board.id,
        input.authorId,
        input.category ?? null,
        input.region ?? null,
        input.title,
        JSON.stringify(input.contentJson),
        text,
        thumb,
      ],
    );
    const postId = (result as { insertId: number }).insertId;

    if (input.deal) {
      const d = input.deal;
      await conn.execute(
        `INSERT INTO post_deals (post_id, shop_id, model, storage, carrier, join_type, principal, plan, plan_months, addons)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [postId, d.shopId, d.model, d.storage, d.carrier, d.joinType, d.principal, d.plan, d.planMonths, JSON.stringify(d.addons)],
      );
    }

    return postId;
  });
}

export async function deletePost(id: number) {
  await execute('DELETE FROM posts WHERE id = ?', [id]);
}

/** 좋아요 토글 — 이미 눌렀으면 취소한다 */
export async function toggleLike(postId: number, userId: number): Promise<{ liked: boolean; likes: number }> {
  return withTransaction(async (conn) => {
    const [rows] = await conn.execute('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
    const liked = (rows as RowDataPacket[]).length > 0;

    if (liked) {
      await conn.execute('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
      await conn.execute('UPDATE posts SET likes = GREATEST(likes - 1, 0) WHERE id = ?', [postId]);
    } else {
      await conn.execute('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
      await conn.execute('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId]);
    }

    const [after] = await conn.execute('SELECT likes FROM posts WHERE id = ?', [postId]);
    const likes = (after as (RowDataPacket & { likes: number })[])[0]?.likes ?? 0;
    return { liked: !liked, likes };
  });
}

/* ── 댓글 ───────────────────────────────────────── */

interface CommentRow extends RowDataPacket {
  id: number;
  post_id: number;
  author_id: number;
  parent_id: number | null;
  content: string;
  likes: number;
  created_at: string;
  nickname: string;
  avatar_color: string;
  level: string;
  role: string;
  user_region: string;
  shop_id: number | null;
  bio: string | null;
  joined_at: string;
}

export async function listComments(postId: number): Promise<Comment[]> {
  const rows = await query<CommentRow>(
    `SELECT c.*, u.nickname, u.avatar_color, u.level, u.role, u.region AS user_region, u.shop_id, u.bio, u.joined_at
       FROM comments c
       JOIN users u ON u.id = c.author_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC`,
    [postId],
  );

  return rows.map((row) => ({
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    parentId: row.parent_id,
    content: row.content,
    likes: row.likes,
    createdAt: row.created_at,
    author: {
      id: row.author_id,
      nickname: row.nickname,
      avatarColor: row.avatar_color,
      level: row.level as PublicUser['level'],
      role: row.role as PublicUser['role'],
      region: row.user_region as PublicUser['region'],
      shopId: row.shop_id,
      bio: row.bio,
      joinedAt: row.joined_at,
    },
  }));
}

export async function createComment(input: { postId: number; authorId: number; content: string; parentId?: number | null }) {
  return withTransaction(async (conn) => {
    const [result] = await conn.execute(
      'INSERT INTO comments (post_id, author_id, parent_id, content) VALUES (?, ?, ?, ?)',
      [input.postId, input.authorId, input.parentId ?? null, input.content],
    );
    // 목록에서 매번 세지 않도록 글에 개수를 들고 있는다
    await conn.execute('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?', [input.postId]);
    return (result as { insertId: number }).insertId;
  });
}
