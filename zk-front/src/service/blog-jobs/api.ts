import { apiFetch } from "@/lib/auth";
import type {
  BlogJobListResponse,
  BlogJobStatus,
  BulkSaveBlogJobsInput,
  BulkSaveBlogJobsResponse,
  DeleteBlogJobsByQuery,
} from "./types";

export async function bulkSaveBlogJobs(
  input: BulkSaveBlogJobsInput,
): Promise<BulkSaveBlogJobsResponse> {
  const res = await apiFetch(`/api/blog-jobs/bulk`, {
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

export async function fetchBlogJobs(opts: {
  status?: BlogJobStatus;
  page?: number;
  limit?: number;
} = {}): Promise<BlogJobListResponse> {
  const p = new URLSearchParams();
  if (opts.status) p.set("status", opts.status);
  if (opts.page) p.set("page", String(opts.page));
  if (opts.limit) p.set("limit", String(opts.limit));
  const qs = p.toString();
  const res = await apiFetch(`/api/blog-jobs${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("예약 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function deleteBlogJob(id: number): Promise<{ ok: true; deleted: number }> {
  const res = await apiFetch(`/api/blog-jobs/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("삭제에 실패했습니다.");
  return res.json();
}

export async function deleteBlogJobsByQuery(
  q: DeleteBlogJobsByQuery,
): Promise<{ ok: true; deleted: number }> {
  const params = new URLSearchParams();
  if (q.all) params.set("all", "1");
  else if (q.status) params.set("status", q.status);
  const res = await apiFetch(`/api/blog-jobs?${params}`, { method: "DELETE" });
  if (!res.ok) throw new Error("삭제에 실패했습니다.");
  return res.json();
}
