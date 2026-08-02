import { apiFetch } from "@/lib/auth";
import type {
  NworkListParams,
  NworkListResponse,
  NworkRow,
  NworkUpdateInput,
} from "./types";

export async function fetchNworkList(
  params: NworkListParams = {},
): Promise<NworkListResponse> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 30));
  if (params.q) qs.set("q", params.q);
  if (params.use_status) qs.set("use_status", params.use_status);
  if (params.task_role) qs.set("task_role", params.task_role);
  if (params.work_used) qs.set("work_used", params.work_used);
  if (params.sort) qs.set("sort", params.sort);
  if (params.order) qs.set("order", params.order);

  const res = await apiFetch(`/api/yongadm/nwork?${qs}`);
  if (!res.ok) throw new Error("아이디 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function updateNwork({
  idx,
  patch,
}: NworkUpdateInput): Promise<NworkRow> {
  const res = await apiFetch(`/api/yongadm/nwork/${idx}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "수정에 실패했습니다.");
  }
  return res.json();
}
