import { apiFetch } from "@/lib/auth";
import type { Member, MemberListResponse, UpdateMemberInput } from "./types";

export async function fetchMembers(
  q = "",
  page = 1,
  limit = 20,
): Promise<MemberListResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (q) params.set("q", q);
  const res = await apiFetch(`/api/users?${params}`);
  if (!res.ok) throw new Error("회원 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function updateMember({
  id,
  role,
  status,
}: UpdateMemberInput): Promise<Member> {
  const res = await apiFetch(`/api/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, status }),
  });
  if (!res.ok) throw new Error("회원 정보를 수정하지 못했습니다.");
  return res.json();
}
