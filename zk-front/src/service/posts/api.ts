import type { PostListResponse, PostDetail } from "./types";

const BACK = process.env.NEXT_PUBLIC_BACK_API ?? "http://localhost:3041";

export async function fetchBoardPosts(
  boardSlug: string,
  page = 1,
  limit = 20,
): Promise<PostListResponse> {
  const params = new URLSearchParams({
    board_slug: boardSlug,
    page: String(page),
    limit: String(limit),
  });
  const res = await fetch(`${BACK}/api/posts/load_lists?${params}`);
  if (!res.ok) throw new Error("게시글 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function fetchPostDetail(id: number): Promise<PostDetail | null> {
  const res = await fetch(`${BACK}/api/posts/detail/${id}`, {
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("게시글을 불러오지 못했습니다.");
  return res.json();
}
