import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateMember } from "./api";

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
}
