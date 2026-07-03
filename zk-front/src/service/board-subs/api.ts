import { apiFetch } from "@/lib/auth";
import type {
  BoardSubListResponse,
  CreateBoardSubInput,
  UpdateBoardSubInput,
  ReorderBoardSubsInput,
} from "./types";

export async function fetchBoardSubs(boardSlug: string): Promise<BoardSubListResponse> {
  const res = await apiFetch(`/api/board-subs?board=${encodeURIComponent(boardSlug)}`);
  if (!res.ok) throw new Error("서브카테고리 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function createBoardSub(input: CreateBoardSubInput): Promise<{ id: number }> {
  const res = await apiFetch(`/api/board-subs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "서브 추가에 실패했습니다.");
  }
  return res.json();
}

export async function updateBoardSub(input: UpdateBoardSubInput): Promise<{ ok: true }> {
  const { id, ...body } = input;
  const res = await apiFetch(`/api/board-subs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("서브 수정에 실패했습니다.");
  return res.json();
}

export async function deleteBoardSub(id: number): Promise<{ ok: true }> {
  const res = await apiFetch(`/api/board-subs/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || "서브 삭제에 실패했습니다.");
  }
  return res.json();
}

export async function reorderBoardSubs(
  input: ReorderBoardSubsInput,
): Promise<{ updated: number }> {
  const res = await apiFetch(`/api/board-subs/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("정렬 반영에 실패했습니다.");
  return res.json();
}
