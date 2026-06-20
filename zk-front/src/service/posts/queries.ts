import { useQuery } from "@tanstack/react-query";
import { fetchBoardPosts } from "./api";

export function useBoardPosts(boardSlug: string, page = 1) {
  return useQuery({
    queryKey: ["posts", boardSlug, page],
    queryFn: () => fetchBoardPosts(boardSlug, page),
  });
}
