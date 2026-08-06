import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth";
import type { NblogJobCategory, NblogLinkStyle } from "./mutations";

export type NblogJobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface NblogJob {
  id: number;
  n_idx: number;
  category: NblogJobCategory;
  keyword: string | null;
  title: string | null;
  link: string | null;
  link_style: NblogLinkStyle | null;
  link_keyword: string | null;
  scheduled_at: string; // 'YYYY-MM-DD HH:MM:SS'
  status: NblogJobStatus;
  result_url: string | null;
  error: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // nwork 조인
  n_id: string;
  work_user_agent: number | null;
  work_profile: string | null;
}

export interface NblogJobListResponse {
  items: NblogJob[];
  counts: Record<NblogJobStatus, number>;
}

export interface NblogJobListParams {
  status?: NblogJobStatus;
  limit?: number;
}

async function fetchNblogJobs(
  params: NblogJobListParams,
): Promise<NblogJobListResponse> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  const res = await apiFetch(`/api/nblog-jobs${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "예약 목록을 불러오지 못했습니다.");
  }
  return res.json();
}

export function useNblogJobs(params: NblogJobListParams = {}) {
  return useQuery({
    queryKey: ["nblog-jobs", params],
    queryFn: () => fetchNblogJobs(params),
    // 실제 발행은 파이썬 워커가 하고, 어드민 UI 는 확인용이라 자동 폴링 X.
    // 상태 확인이 필요하면 🔄 버튼으로 수동 새로고침.
  });
}

async function deleteNblogJob(id: number): Promise<{ ok: boolean }> {
  const res = await apiFetch(`/api/nblog-jobs/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "삭제에 실패했습니다.");
  }
  return res.json();
}

export function useDeleteNblogJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteNblogJob,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nblog-jobs"] }),
  });
}
