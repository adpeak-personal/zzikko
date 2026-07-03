import { cache } from "react";
import { BACK_API } from "@/lib/backend-url";
import type { BoardSub } from "./types";

/**
 * SSR 전용 — board_slug 로 서브카테고리 목록을 fetch.
 *
 * 캐시 전략:
 *   1) React.cache — 같은 요청 트리 안에서 dedupe (page + generateMetadata 이중 호출 방지)
 *   2) Next.js fetch revalidate — 5분 tag 기반. 어드민에서 변경 시엔 결과적으로 다음 revalidate 에 반영.
 *
 * 실패 시 [] 리턴 — 카테고리 페이지가 subs fetch 실패로 500 나면 안 됨.
 */
export const getBoardSubs = cache(async (boardSlug: string): Promise<BoardSub[]> => {
  try {
    const res = await fetch(
      `${BACK_API}/api/board-subs?board=${encodeURIComponent(boardSlug)}`,
      {
        signal: AbortSignal.timeout(3000),
        next: { revalidate: 300, tags: [`board-subs:${boardSlug}`] },
      },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { items: BoardSub[] };
    return json.items ?? [];
  } catch {
    return [];
  }
});

/** 어드민만 서브 탭 노출 조건까지 반영해 필터. current 는 활성 tab (URL 상 sub) — 있으면 hidden 여도 노출. */
export function filterSubsForRole(
  subs: BoardSub[],
  isAdmin: boolean,
  current?: string,
): BoardSub[] {
  return subs.filter((s) => !s.hidden_from_nav || isAdmin || s.slug === current);
}
