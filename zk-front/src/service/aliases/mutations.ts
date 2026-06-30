import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  bulkCreateAliases,
  bulkDeleteAliases,
  toggleAlias,
} from "./api";

export function useBulkCreateAliases() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkCreateAliases,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aliases"] });
    },
  });
}

export function useBulkDeleteAliases() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkDeleteAliases,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aliases"] });
    },
  });
}

export function useToggleAlias() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: toggleAlias,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["aliases"] });
    },
  });
}
