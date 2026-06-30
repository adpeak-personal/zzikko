import { useQuery } from "@tanstack/react-query";
import { fetchBlogJobs } from "./api";
import type { BlogJobStatus } from "./types";

export function useBlogJobs(opts: {
  status?: BlogJobStatus;
  page?: number;
  limit?: number;
} = {}) {
  return useQuery({
    queryKey: ["blog-jobs", opts.status ?? "all", opts.page ?? 1, opts.limit ?? 100],
    queryFn: () => fetchBlogJobs(opts),
    // 워커가 background 에서 상태 바꾸므로 주기적으로 새로고침
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
}
