import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth";

export type NblogJobCategory = "cate1" | "cate2" | "cate3" | "cate4";
export type NblogLinkStyle = "anchor" | "onbox" | "nobox";

export interface NblogJobInputItem {
  n_idx: number;
  category: NblogJobCategory;
  keyword?: string;
  title?: string;
  scheduled_at: string; // ISO 문자열
  link?: string;
  link_style?: NblogLinkStyle;
  /** anchor 스타일일 때 앵커 텍스트 오버라이드. 비면 워커가 keyword 로 폴백. */
  link_keyword?: string;
}

export interface BulkSaveNblogJobsInput {
  items: NblogJobInputItem[];
}

export interface BulkSaveNblogJobsResponse {
  saved: number;
  inserted_ids: number[];
}

async function bulkSaveNblogJobs(
  input: BulkSaveNblogJobsInput,
): Promise<BulkSaveNblogJobsResponse> {
  const res = await apiFetch(`/api/nblog-jobs/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "예약 저장에 실패했습니다.");
  }
  return res.json();
}

export function useBulkSaveNblogJobs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkSaveNblogJobs,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nblog-jobs"] }),
  });
}
