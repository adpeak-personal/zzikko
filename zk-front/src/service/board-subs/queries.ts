import { useQuery } from "@tanstack/react-query";
import { fetchBoardSubs } from "./api";

export function useBoardSubs(boardSlug: string) {
  return useQuery({
    queryKey: ["board-subs", boardSlug],
    queryFn: () => fetchBoardSubs(boardSlug),
    enabled: !!boardSlug,
  });
}
