import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createBoardSub,
  updateBoardSub,
  deleteBoardSub,
  reorderBoardSubs,
} from "./api";

export function useCreateBoardSub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createBoardSub,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-subs"] }),
  });
}

export function useUpdateBoardSub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateBoardSub,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-subs"] }),
  });
}

export function useDeleteBoardSub() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteBoardSub,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-subs"] }),
  });
}

export function useReorderBoardSubs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: reorderBoardSubs,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["board-subs"] }),
  });
}
