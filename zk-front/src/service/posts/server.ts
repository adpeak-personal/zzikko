import { cache } from "react";
import { BACK_API } from "@/lib/backend-url";
import { fetchPostDetail } from "./api";
import type { PostListResponse } from "./types";

/**
 * 서버 사이드 전용 — 같은 요청 트리 안에서 fetchPostDetail 을 한 번만 실행하도록 dedupe.
 *
 * 왜 필요한가:
 *   상세 페이지는 `generateMetadata` 와 페이지 컴포넌트가 각각 `fetchPostDetail` 을 호출한다.
 *   백엔드가 view_count 를 증가시키기 때문에, 이 두 호출이 dedupe 되지 않으면 조회수가
 *   실제 방문 1회당 2씩 오르는 버그가 생긴다. React.cache 로 한 렌더 내 결과를 공유해서 방지.
 */
export const getPostDetailCached = cache(async (id: number) => {
  return fetchPostDetail(id);
});

/**
 * SSR 전용 — 카테고리 리스트 첫 페이지 fetch.
 * 크롤러가 초기 HTML 에서 게시글 링크/제목을 볼 수 있게 서버 렌더링용으로 사용.
 *
 * 실패 시 null — 페이지 자체가 500 나면 안 되므로 렌더에서 fallback UI 처리.
 */
export const getBoardPostsCached = cache(
  async (
    boardSlug: string,
    page = 1,
    limit = 20,
    subSlug?: string,
  ): Promise<PostListResponse | null> => {
    const params = new URLSearchParams({
      board_slug: boardSlug,
      page: String(page),
      limit: String(limit),
    });
    if (subSlug) params.set("sub_slug", subSlug);
    try {
      const res = await fetch(`${BACK_API}/api/posts/load_lists?${params}`, {
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 60 },
      });
      if (!res.ok) return null;
      return (await res.json()) as PostListResponse;
    } catch {
      return null;
    }
  },
);
