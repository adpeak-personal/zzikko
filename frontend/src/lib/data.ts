import { ApiError, query } from './api';
import { apiGet, apiGetOrNull } from './api.server';
import type { Board, BoardGroup, Comment, Me, Paged, Post, PublicUser, Shop } from './types';

/**
 * 서버 컴포넌트에서 쓰는 데이터 조회.
 * 화면은 백엔드 주소나 응답 형태를 직접 알 필요 없이 이 파일만 호출한다.
 */

/**
 * 게시판 목록.
 *
 * 헤더·사이드바가 모든 화면에서 부르므로, 백엔드에 닿지 못하면 메뉴만 비우고 넘어간다 —
 * 백엔드를 재시작하는 동안 사이트 전체가 에러 화면이 되지 않게.
 * (로그인 확인인 getCurrentUser 도 같은 이유로 실패를 삼킨다.)
 */
export async function getBoardGroups(): Promise<BoardGroup[]> {
  try {
    const { items } = await apiGet<{ items: BoardGroup[] }>('/boards');
    return items;
  } catch (error) {
    // 서버가 살아서 에러를 준 거라면 진짜 문제다 — 그건 그대로 터뜨린다
    if (error instanceof ApiError) throw error;
    console.warn('[getBoardGroups] 백엔드에 닿지 못했습니다', error);
    return [];
  }
}

export async function getBoards(): Promise<Board[]> {
  return (await getBoardGroups()).flatMap((group) => group.boards);
}

export async function getBoard(slug: string): Promise<Board | null> {
  return apiGetOrNull<Board>(`/boards/${encodeURIComponent(slug)}`);
}

/**
 * 수정 화면이 쓸 원본.
 *
 * 남의 글이면 서버가 403 을 준다 — 존재를 알려줄 필요가 없으니 null 로 덮는다.
 */
export async function getPostForEdit(id: number): Promise<Post | null> {
  try {
    return await apiGet<Post>(`/posts/${id}/edit`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 403 || err.status === 404)) return null;
    throw err;
  }
}

/** 내가 스크랩한 글 */
export async function getMyScraps(page = 1, size = 20): Promise<Paged<Post>> {
  return apiGet<Paged<Post>>(`/me/scraps${query({ page, size })}`);
}

export interface PostQuery {
  boardSlug?: string;
  category?: string;
  region?: string;
  q?: string;
  /** 검색 범위 — 기본은 제목+내용 */
  scope?: 'title_content' | 'title' | 'content' | 'author';
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
