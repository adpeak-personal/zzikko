import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne, withTransaction } from '../db/pool.js';
import { findFirstImage, toPlainText } from '../lib/editor.js';
import type { Comment, DealInfo, Paged, Post, PublicUser } from '../types.js';

/** 검색 범위 — 기본은 제목+내용 */
export type SearchScope = 'title_content' | 'title' | 'content' | 'author';
export const SEARCH_SCOPES: SearchScope[] = ['title_content', 'title', 'content', 'author'];

/** LIKE 패턴에서 특수문자를 글자 그대로 취급하게 한다 */
const escapeLike = (raw: string) => raw.replace(/[\\%_]/g, (ch) => '\\' + ch);

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
  /** 검색 범위 — 기본은 제목+내용 */
  scope?: SearchScope;
  authorId?: number;
  shopId?: number;
  sort?: 'latest' | 'popular';
  page?: number;
  size?: number;
}

/** 목록 — 공지는 제외하고 내려준다 (공지는 listNotices 로 따로 가져간다) */
export async function listPosts(filter: PostQuery): Promise<Paged<Post>> {
  const { boardSlug, category, region, q, scope, authorId, shopId, sort = 'latest', page = 1, size = 15 } = filter;

  // 지운 글은 어느 목록에도 나오지 않는다
  const where: string[] = ['p.is_notice = 0', 'p.deleted_at IS NULL'];
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
    // 짧은 검색어도 걸리도록 LIKE 로 찾는다 (글이 많아지면 FULLTEXT 로 바꾼다).
    // LIKE 특수문자를 그대로 넣으면 "%" 한 글자로 전체가 걸린다
    const like = `%${escapeLike(q)}%`;
    switch (scope) {
      case 'title':
        where.push('p.title LIKE ?');
        params.push(like);
        break;
      case 'content':
        where.push('p.content_text LIKE ?');
        params.push(like);
        break;
      case 'author':
        where.push('u.nickname LIKE ?');
        params.push(like);
        break;
      default:
        where.push('(p.title LIKE ? OR p.content_text LIKE ?)');
        params.push(like, like);
    }
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
  const rows = await query<PostRow>(`${SELECT_POST} WHERE p.is_notice = 1 AND p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT ?`, [limit]);
  return rows.map(toPost);
}

export async function getPost(id: number): Promise<Post | null> {
  const row = await queryOne<PostRow>(`${SELECT_POST} WHERE p.id = ? AND p.deleted_at IS NULL`, [id]);
  return row ? toPost(row) : null;
}

/** 지운 글까지 포함해 가져온다 — 운영 화면과 복구에 쓴다 */
export async function getPostIncludingDeleted(id: number): Promise<Post | null> {
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

export interface PostPatch {
  title?: string;
  category?: string | null;
  region?: string | null;
  contentJson?: unknown;
}

/**
 * 글 수정 — 넘어온 필드만 바꾼다.
 *
 * 게시판 이동은 여기서 하지 않는다. 게시판마다 글쓰기 권한(판매자 전용 등)이 달라서,
 * 글쓴이가 자기 글을 아무 게시판으로나 옮길 수 있으면 그 규칙이 무의미해진다.
 */
export async function updatePost(id: number, patch: PostPatch): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const put = (col: string, value: unknown) => {
    sets.push(`${col} = ?`);
    params.push(value);
  };

  if (patch.title !== undefined) put('title', patch.title);
  if (patch.category !== undefined) put('category', patch.category);
  if (patch.region !== undefined) put('region', patch.region);
  if (patch.contentJson !== undefined) {
    // 평문과 썸네일은 본문에서 다시 뽑는다 — 본문만 바꾸고 둘을 안 고치면 어긋난다
    put('content_json', JSON.stringify(patch.contentJson));
    put('content_text', toPlainText(patch.contentJson));
    put('thumb_url', findFirstImage(patch.contentJson));
  }

  if (sets.length === 0) return;
  params.push(id);
  await execute(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`, params);
}

/**
 * 글 삭제 — 소프트 삭제.
 *
 * 실제로 지우지 않는 이유: 댓글·좋아요가 글을 CASCADE 로 참조하고 있어서
 * 지우면 같이 날아가고, 잘못 지웠을 때 되돌릴 방법이 없다.
 */
export async function softDeletePost(id: number): Promise<boolean> {
  const { affectedRows } = await execute(
    'UPDATE posts SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return affectedRows > 0;
}

/**
 * 목록 썸네일 주소를 지정한다.
 *
 * createPost/updatePost 가 본문에서 첫 이미지를 뽑아 넣어 두지만, 그건 본문용 원본이다.
 * 썸네일을 만든 뒤 그 주소로 바꿔 끼운다 — 저장된 값이 곧 실제로 있는 파일이 되도록.
 */
export async function setThumbUrl(postId: number, thumbUrl: string): Promise<void> {
  await execute('UPDATE posts SET thumb_url = ? WHERE id = ?', [thumbUrl, postId]);
}

/** 지운 글 되살리기 */
export async function restorePost(id: number): Promise<boolean> {
  const { affectedRows } = await execute(
    'UPDATE posts SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL',
    [id],
  );
  return affectedRows > 0;
}

/* ── 스크랩 ─────────────────────────────────────── */

/**
 * 스크랩 토글.
 *
 * 좋아요와 달리 공개 집계를 두지 않는다 — "나중에 볼 글" 이라 본인에게만 보인다.
 */
export async function toggleScrap(postId: number, userId: number): Promise<{ scrapped: boolean }> {
  return withTransaction(async (conn) => {
    const [rows] = await conn.execute('SELECT 1 FROM post_scraps WHERE post_id = ? AND user_id = ?', [postId, userId]);
    const scrapped = (rows as RowDataPacket[]).length > 0;

    if (scrapped) {
      await conn.execute('DELETE FROM post_scraps WHERE post_id = ? AND user_id = ?', [postId, userId]);
    } else {
      await conn.execute('INSERT INTO post_scraps (post_id, user_id) VALUES (?, ?)', [postId, userId]);
    }
    return { scrapped: !scrapped };
  });
}

/** 글 상세에서 "내가 누른 상태" — 비로그인이면 호출하지 않는다 */
export async function getMyReaction(postId: number, userId: number) {
  const row = await queryOne<RowDataPacket & { liked: number; scrapped: number }>(
    `SELECT EXISTS(SELECT 1 FROM post_likes  WHERE post_id = ? AND user_id = ?) AS liked,
            EXISTS(SELECT 1 FROM post_scraps WHERE post_id = ? AND user_id = ?) AS scrapped`,
    [postId, userId, postId, userId],
  );
  return { liked: Number(row?.liked) === 1, scrapped: Number(row?.scrapped) === 1 };
}

/** 마이페이지 "내 스크랩" — 스크랩한 순서(최신)대로 */
export async function listScrappedPosts(userId: number, page = 1, size = 20): Promise<Paged<Post>> {
  const countRow = await queryOne<RowDataPacket & { total: number }>(
    `SELECT COUNT(*) AS total FROM post_scraps s JOIN posts p ON p.id = s.post_id
      WHERE s.user_id = ? AND p.deleted_at IS NULL`,
    [userId],
  );

  const rows = await query<PostRow>(
    `${SELECT_POST}
       JOIN post_scraps s ON s.post_id = p.id
      WHERE s.user_id = ? AND p.deleted_at IS NULL
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?`,
    [userId, size, (page - 1) * size],
  );

  return { items: rows.map(toPost), total: countRow?.total ?? 0, page, size };
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
      WHERE c.post_id = ? AND c.deleted_at IS NULL
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

export async function getComment(id: number) {
  return queryOne<RowDataPacket & { id: number; post_id: number; author_id: number }>(
    'SELECT id, post_id, author_id FROM comments WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
}

export async function updateComment(id: number, content: string): Promise<void> {
  await execute('UPDATE comments SET content = ? WHERE id = ?', [content, id]);
}

/** 댓글 삭제 — 소프트 삭제 + 글의 댓글 수 감소 */
export async function softDeleteComment(id: number, postId: number): Promise<boolean> {
  return withTransaction(async (conn) => {
    const [res] = await conn.execute(
      'UPDATE comments SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    const ok = (res as { affectedRows: number }).affectedRows > 0;
    if (ok) {
      // 0 밑으로 내려가지 않게 한다 — 집계가 어긋난 적이 있어도 음수가 되면 안 된다
      await conn.execute('UPDATE posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = ?', [postId]);
    }
    return ok;
  });
}

/** 댓글 좋아요 토글 — comments.likes 는 이 표의 개수를 캐시한 값이다 */
export async function toggleCommentLike(commentId: number, userId: number): Promise<{ liked: boolean; likes: number }> {
  return withTransaction(async (conn) => {
    const [rows] = await conn.execute('SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
    const liked = (rows as RowDataPacket[]).length > 0;

    if (liked) {
      await conn.execute('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
      await conn.execute('UPDATE comments SET likes = GREATEST(likes - 1, 0) WHERE id = ?', [commentId]);
    } else {
      await conn.execute('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', [commentId, userId]);
      await conn.execute('UPDATE comments SET likes = likes + 1 WHERE id = ?', [commentId]);
    }

    const [after] = await conn.execute('SELECT likes FROM comments WHERE id = ?', [commentId]);
    const likes = (after as (RowDataPacket & { likes: number })[])[0]?.likes ?? 0;
    return { liked: !liked, likes };
  });
}

/** 이 글의 댓글 중 내가 좋아요 누른 것 — 댓글마다 묻지 않고 한 번에 (N+1 방지) */
export async function getMyLikedCommentIds(postId: number, userId: number): Promise<number[]> {
  const rows = await query<RowDataPacket & { comment_id: number }>(
    `SELECT cl.comment_id FROM comment_likes cl
       JOIN comments c ON c.id = cl.comment_id
      WHERE c.post_id = ? AND cl.user_id = ?`,
    [postId, userId],
  );
  return rows.map((r) => Number(r.comment_id));
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
