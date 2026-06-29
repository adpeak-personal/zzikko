import { apiFetch } from "@/lib/auth";
import type {
  BulkCreateKeywordsInput,
  BulkCreateKeywordsResponse,
  BulkDeleteKeywordsInput,
  BulkDeleteKeywordsResponse,
  KeywordCategory,
  KeywordListResponse,
} from "./types";

export async function fetchKeywords(
  category?: KeywordCategory,
): Promise<KeywordListResponse> {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  const qs = params.toString();
  const res = await apiFetch(`/api/keywords${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("키워드 목록을 불러오지 못했습니다.");
  return res.json();
}

export async function bulkCreateKeywords(
  input: BulkCreateKeywordsInput,
): Promise<BulkCreateKeywordsResponse> {
  const res = await apiFetch(`/api/keywords/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("키워드를 추가하지 못했습니다.");
  return res.json();
}

export async function bulkDeleteKeywords(
  input: BulkDeleteKeywordsInput,
): Promise<BulkDeleteKeywordsResponse> {
  const res = await apiFetch(`/api/keywords/bulk`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("키워드를 삭제하지 못했습니다.");
  return res.json();
}
