import { apiFetch } from "@/lib/auth";
import type {
  GenerateBlogTitlesInput,
  GenerateBlogTitlesResponse,
} from "./types";

export async function generateBlogTitles(
  input: GenerateBlogTitlesInput,
): Promise<GenerateBlogTitlesResponse> {
  const res = await apiFetch(`/api/ai/blog-titles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "AI 제목 생성에 실패했습니다.");
  }
  return res.json();
}
