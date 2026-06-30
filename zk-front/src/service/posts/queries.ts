import { useQuery } from "@tanstack/react-query";
import { fetchBoardPosts } from "./api";

export function useBoardPosts(boardSlug: string, page = 1, subSlug?: string) {
  return useQuery({
    queryKey: ["posts", boardSlug, subSlug ?? null, page],
    queryFn: () => fetchBoardPosts(boardSlug, page, 20, subSlug),
  });
}
