"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth";
import { apiFetch } from "@/lib/auth";

/**
 * 글 상단 작성자 전용 버튼 (수정 / 삭제).
 * 로그인한 사용자가 글 작성자(또는 관리자가 아닌 일반)일 때만 보인다.
 */
export default function PostOwnerActions({
  postId,
  authorId,
  boardSlug,
}: {
  postId: number;
  authorId: number | null;
  boardSlug: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [deleting, setDeleting] = useState(false);

  // 본인 글이 아니면 아무것도 렌더하지 않음
  if (!user || authorId === null || user.id !== authorId) return null;

  async function handleDelete() {
    if (!confirm("이 글을 삭제할까요?\n본문 이미지까지 모두 삭제되며 되돌릴 수 없습니다.")) return;
    try {
      setDeleting(true);
      const res = await apiFetch(`/api/posts/${postId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? "삭제에 실패했습니다.");
      }
      // 목록 캐시 무효화 → 삭제된 글이 바로 사라지게
      await queryClient.invalidateQueries({ queryKey: ["posts", boardSlug] });
      router.push(`/category/${boardSlug}`);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제에 실패했습니다.");
      setDeleting(false);
    }
  }

  function handleEdit() {
    // TODO: 수정 페이지 연결 (다음 단계)
    alert("수정 기능은 곧 추가됩니다.");
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={handleEdit}
        className="text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        수정
      </button>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="text-xs font-bold text-rose-600 bg-white border border-rose-200 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors"
      >
        {deleting ? "삭제 중..." : "삭제"}
      </button>
    </div>
  );
}
