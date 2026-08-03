import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/auth";

export type NblogTitleCategory = "cate1" | "cate2" | "cate3" | "cate4";

export interface NblogTitleRequestItem {
  category: NblogTitleCategory;
  keyword?: string;
}

export interface NblogTitleResultItem {
  ok: boolean;
  title: string;
  keyword: string;
  error?: string;
}

export interface GenerateNblogTitlesResponse {
  items: NblogTitleResultItem[];
  total: number;
  succeeded: number;
  failed: number;
}

async function generateNblogTitles(
  items: NblogTitleRequestItem[],
): Promise<GenerateNblogTitlesResponse> {
  const res = await apiFetch(`/api/ai/nblog-titles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "AI 제목 생성에 실패했습니다.");
  }
  return res.json();
}

export function useGenerateNblogTitles() {
  return useMutation({ mutationFn: generateNblogTitles });
}
