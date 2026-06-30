import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  bulkSaveBlogJobs,
  deleteBlogJob,
  deleteBlogJobsByQuery,
} from "./api";

export function useBulkSaveBlogJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkSaveBlogJobs,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-jobs"] });
    },
  });
}

export function useDeleteBlogJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBlogJob,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-jobs"] });
    },
  });
}

export function useDeleteBlogJobsByQuery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBlogJobsByQuery,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["blog-jobs"] });
    },
  });
}
