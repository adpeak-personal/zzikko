import { useMutation } from "@tanstack/react-query";
import { bulkSaveBlogJobs } from "./api";

export function useBulkSaveBlogJobs() {
  return useMutation({
    mutationFn: bulkSaveBlogJobs,
  });
}
