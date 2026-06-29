import { useQuery } from "@tanstack/react-query";
import { fetchKeywords } from "./api";
import type { KeywordCategory } from "./types";

export function useKeywords(category?: KeywordCategory) {
  return useQuery({
    queryKey: ["keywords", category ?? "all"],
    queryFn: () => fetchKeywords(category),
  });
}
