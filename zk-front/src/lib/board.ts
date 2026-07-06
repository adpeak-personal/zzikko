/** 카테고리 리스트 페이지네이션 — 페이지당 게시글 수. */
export const POSTS_PER_PAGE = 15;

/** searchParams.page 를 안전한 정수(>=1) 로. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
