"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import TibTapEditor from "@/components/common/Editor";
import { apiFetch } from "@/lib/auth";
import { useAuthStore } from "@/store/auth";
import { MALLS } from "@/data/constants";
import { CATEGORIES } from "@/config/navigation";

function parsePriceFromTitle(title: string): number | null {
  // "19,900원" / "19900원"
  const wonMatch = title.match(/([\d,]+)원/);
  if (wonMatch) {
    const n = parseInt(wonMatch[1].replace(/,/g, ""), 10);
    if (!isNaN(n)) return n;
  }
  // "19.9만원" / "19만원"
  const manMatch = title.match(/([\d.]+)만원/);
  if (manMatch) {
    const n = parseFloat(manMatch[1]);
    if (!isNaN(n)) return Math.round(n * 10000);
  }
  return null;
}

export default function WritePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuthStore();

  // 쿼리스트링 ?board=blog&sub=humor 같은 형태로 들어옴. 미지정 시 hotdeal (기본).
  const boardSlug = searchParams.get("board") ?? "hotdeal";
  const subSlug = searchParams.get("sub") ?? undefined;
  const board = CATEGORIES.find((c) => c.slug === boardSlug);
  const isHotdeal = boardSlug === "hotdeal";

  const [title, setTitle] = useState("");
  const [parsedPrice, setParsedPrice] = useState<number | null>(null);
  const [selectedMall, setSelectedMall] = useState<string>(MALLS[0]);
  const [customMall, setCustomMall] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.push("/auth/login");
  }, [user, isLoading, router]);

  function handleTitleChange(val: string) {
    setTitle(val);
    if (isHotdeal) setParsedPrice(parsePriceFromTitle(val));
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    if (!content.trim()) { setError("본문을 입력해주세요."); return; }

    // 게시판별 extra_data 차이 — 핫딜만 mall/price 가 필요
    let extra_data: Record<string, unknown> | undefined;
    if (isHotdeal) {
      const mall = selectedMall === "직접 입력" ? customMall.trim() : selectedMall;
      extra_data = { mall, price: parsedPrice, is_ended: false };
    }

    try {
      setSubmitting(true);
      const res = await apiFetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          board_slug: boardSlug,
          ...(subSlug ? { sub_slug: subSlug } : {}),
          title,
          content,
          ...(extra_data ? { extra_data } : {}),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? "등록 실패");
      }
      // 목록 캐시 무효화 → 새 글이 바로 보이게
      await queryClient.invalidateQueries({ queryKey: ["posts", boardSlug] });
      // 등록 후 이동 — 서브카테고리가 있으면 그 페이지로
      router.push(subSlug ? `/category/${boardSlug}/${subSlug}` : `/category/${boardSlug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-[#0f1115] flex items-center justify-center text-slate-400 text-sm">로딩 중...</div>
  );
  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 상단 헤더 */}
      <div className="sticky top-0 z-30 bg-[#0f1115] border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            href={subSlug ? `/category/${boardSlug}/${subSlug}` : `/category/${boardSlug}`}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            뒤로
          </Link>
          <span className="text-white font-bold text-sm flex-1">
            {board?.title ?? boardSlug} 등록
            {subSlug && board?.subs?.find((s) => s.slug === subSlug) && (
              <span className="ml-1.5 text-xs font-normal text-slate-400">
                · {board.subs.find((s) => s.slug === subSlug)?.title}
              </span>
            )}
          </span>
          <button
            form="write-form"
            type="submit"
            disabled={submitting}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-1.5 rounded-lg transition-colors"
          >
            {submitting ? "등록 중..." : "등록하기"}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">
        <form id="write-form" onSubmit={handleSubmit} className="space-y-5">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {/* 기본 정보 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-700">기본 정보</h2>

            {/* 제목 */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text" required value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder={
                  isHotdeal
                    ? "예) [쿠팡] 삼성 65W 충전기 19,900원 역대최저"
                    : "제목을 입력하세요"
                }
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              />
              {isHotdeal && parsedPrice !== null && (
                <p className="mt-1.5 text-xs text-blue-600 font-medium">
                  💰 파싱된 가격: {parsedPrice.toLocaleString()}원
                </p>
              )}
            </div>

            {/* 쇼핑몰 — 핫딜 전용 */}
            {isHotdeal && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">쇼핑몰</label>
                <select
                  value={selectedMall}
                  onChange={(e) => setSelectedMall(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:border-blue-400"
                >
                  {MALLS.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {selectedMall === "직접 입력" && (
                  <input
                    type="text" value={customMall}
                    onChange={(e) => setCustomMall(e.target.value)}
                    placeholder="쇼핑몰 이름 입력"
                    className="mt-2 w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                )}
              </div>
            )}
          </div>

          {/* 본문 */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500">
              본문 <span className="text-red-500">*</span>
            </label>
            <TibTapEditor onChange={setContent} />
          </div>

        </form>
      </div>
    </div>
  );
}
