import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { fetchNworkList, updateNwork } from "./api";
import type { NworkListParams, NworkListResponse, NworkRow } from "./types";

export function useNworkList(params: NworkListParams) {
  return useQuery({
    queryKey: ["nwork", params],
    queryFn: () => fetchNworkList(params),
    placeholderData: keepPreviousData,
  });
}

// PATCH → 현재 캐시(모든 nwork 쿼리)에서 해당 row 를 in-place 로 교체.
// 사용자 뷰가 필터/정렬/페이지 여러 조합이더라도 열려있는 페이지는 즉시 반영.
export function useUpdateNwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateNwork,
    onSuccess: (updated: NworkRow) => {
      qc.setQueriesData<NworkListResponse>(
        { queryKey: ["nwork"] },
        (old) => {
          if (!old) return old;
          const items = old.items.map((r) => (r.n_idx === updated.n_idx ? updated : r));
          return { ...old, items };
        },
      );
    },
  });
}
