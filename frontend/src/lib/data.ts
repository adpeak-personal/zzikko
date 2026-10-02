import { query } from './api';
import { apiGet, apiGetOrNull } from './api.server';
import type { Board, BoardGroup, Comment, Me, Paged, Post, PublicUser, Shop } from './types';

/**
 * 서버 컴포넌트에서 쓰는 데이터 조회.
 * 화면은 백엔드 주소나 응답 형태를 직접 알 필요 없이 이 파일만 호출한다.
 */

export async function getBoardGroups(): Promise<BoardGroup[]> {
  const { items } = await apiGet<{ items: BoardGroup[] }>('/boards');
  return items;
}

export async function getBoards(): Promise<Board[]> {
  return (await getBoardGroups()).flatMap((group) => group.boards);
}

export async function getBoard(slug: string): Promise<Board | null> {
  return apiGetOrNull<Board>(`/boards/${encodeURIComponent(slug)}`);
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

/** 목록 + 1페이지에서는 공지도 함께 내려온다 */
export async function getPosts(filter: PostQuery = {}): Promise<Paged<Post> & { notices: Post[] }> {
  return apiGet<Paged<Post> & { notices: Post[] }>(`/posts${query({ ...filter })}`);
}

export async function getPost(id: number): Promise<Post | null> {
  return apiGetOrNull<Post>(`/posts/${id}`);
}

export async function getComments(postId: number): Promise<Comment[]> {
  const { items } = await apiGet<{ items: Comment[] }>(`/posts/${postId}/comments`);
  return items;
}

export async function getShops(): Promise<Shop[]> {
  const { items } = await apiGet<{ items: Shop[] }>('/shops');
  return items;
}

export async function getShopBySlug(slug: string) {
  return apiGetOrNull<{ shop: Shop; posts: Post[] }>(`/shops/${encodeURIComponent(slug)}`);
}

/** 로그인한 회원 (안 했으면 null) */
export async function getCurrentUser(): Promise<Me | null> {
  try {
    return await apiGet<Me>('/auth/me');
  } catch {
    return null;
  }
}

/* ── 화면에서 자주 쓰는 조합 ───────────────────────── */

/** 시세 글만 최신순 */
export async function getDeals(limit = 5): Promise<Post[]> {
  const { items } = await getPosts({ boardSlug: 'deals', size: limit });
  return items;
}

/** 할부원금이 가장 낮은 시세 글 */
export async function getLowestDeal(): Promise<Post | undefined> {
  const { items } = await getPosts({ boardSlug: 'deals', size: 50 });
  return items
    .filter((post) => post.deal)
    .reduce<Post | undefined>((best, post) => (!best || post.deal!.principal < best.deal!.principal ? post : best), undefined);
}

export async function getPopular(limit = 8): Promise<Post[]> {
  const { items } = await getPosts({ sort: 'popular', size: limit });
  return items;
}

export type { PublicUser };
