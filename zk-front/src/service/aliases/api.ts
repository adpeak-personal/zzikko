import { apiFetch } from "@/lib/auth";
import type {
  AliasListResponse,
  BulkCreateAliasesInput,
  BulkCreateAliasesResponse,
  BulkDeleteAliasesInput,
  ToggleAliasInput,
} from "./types";

export async function fetchAliases(userId: number): Promise<AliasListResponse> {
  const res = await apiFetch(`/api/admin/aliases?user_id=${userId}`);
  if (!res.ok) throw new Error("alias 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function bulkCreateAliases(
  input: BulkCreateAliasesInput,
): Promise<BulkCreateAliasesResponse> {
  const res = await apiFetch(`/api/admin/aliases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("alias 추가에 실패했습니다.");
  return res.json();
}

export async function bulkDeleteAliases(
  input: BulkDeleteAliasesInput,
): Promise<{ deleted: number }> {
  const res = await apiFetch(`/api/admin/aliases/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("alias 삭제에 실패했습니다.");
  return res.json();
}

export async function toggleAlias(input: ToggleAliasInput): Promise<{ ok: true }> {
  const res = await apiFetch(`/api/admin/aliases/${input.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: input.is_active }),
  });
  if (!res.ok) throw new Error("상태 변경에 실패했습니다.");
  return res.json();
}
