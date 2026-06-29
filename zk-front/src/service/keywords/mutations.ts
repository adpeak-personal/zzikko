import { useMutation, useQueryClient } from "@tanstack/react-query";
import { bulkCreateKeywords, bulkDeleteKeywords } from "./api";

export function useBulkCreateKeywords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkCreateKeywords,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keywords"] });
    },
  });
}

export function useBulkDeleteKeywords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkDeleteKeywords,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["keywords"] });
    },
  });
}
