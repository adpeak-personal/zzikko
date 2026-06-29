import { apiFetch } from "@/lib/auth";
import type {
  BulkSaveBlogJobsInput,
  BulkSaveBlogJobsResponse,
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
