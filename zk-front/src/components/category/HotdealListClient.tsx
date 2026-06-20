"use client";

import Image from "next/image";
import Link from "next/link";
import { useBoardPosts } from "@/service/posts";

export default function HotdealListClient() {
  const { data, isPending, isError } = useBoardPosts("hotdeal");

  if (isPending) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm text-slate-400">
        불러오는 중...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm text-red-400">
        게시글을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
      </div>
    );
  }

  const deals = data.data.map((p) => ({
    id: p.id,
    title: p.title,
    author: p.author ?? "익명",
    comments: p.comment_count,
    views: p.views,
    thumb: p.thumb,
    daysAgo: Math.floor(
      (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24),
    ),
    mall: p.extra_data?.mall ?? "-",
    price: p.extra_data?.price ?? 0,
    discount: p.extra_data?.discount_rate ?? 0,
    freeShipping: p.extra_data?.free_shipping ?? false,
    isEnded: p.extra_data?.is_ended ?? false,
  }));

  if (deals.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm text-slate-400">
        아직 게시글이 없어요.
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="hidden md:grid grid-cols-[72px_80px_1fr_110px_90px_70px_70px_90px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500">
        <div className="text-center">썸네일</div>
        <div className="text-center">쇼핑몰</div>
        <div>제목</div>
        <div className="text-right">가격</div>
        <div className="text-center">작성자</div>
        <div className="text-center">댓글</div>
        <div className="text-center">조회</div>
        <div className="text-center">작성일</div>
      </div>

      <ul className="divide-y divide-slate-100">
        {deals.map((d) => (
          <li key={d.id}>
            <Link href={`/posts/hotdeal/${d.id}`} className="block hover:bg-pink-50/40 transition-colors">
              {/* PC 행 */}
              <div className="hidden md:grid grid-cols-[72px_80px_1fr_110px_90px_70px_70px_90px] gap-4 items-center px-5 py-3 text-sm">
                <div className="flex justify-center">
                  {d.thumb ? (
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      <Image src={d.thumb} alt="" fill sizes="56px" className={`object-cover ${d.isEnded ? "opacity-50 grayscale" : ""}`} />
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-xl">🏷️</div>
                  )}
                </div>
                <div className="flex justify-center">
                  <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{d.mall}</span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  {d.isEnded
                    ? <span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">종료</span>
                    : <span className="bg-pink-100 text-pink-600 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">진행중</span>
                  }
                  <span className={`font-medium truncate ${d.isEnded ? "text-slate-400 line-through" : "text-slate-800"}`}>{d.title}</span>
                  {d.freeShipping && <span className="text-[10px] font-bold text-emerald-600 shrink-0">무료배송</span>}
                  {d.comments > 0 && <span className="text-pink-600 text-xs font-bold shrink-0">[{d.comments}]</span>}
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-pink-600">{d.price.toLocaleString()}원</span>
                  <span className="block text-[10px] font-bold text-red-500">{d.discount}%↓</span>
                </div>
                <div className="text-center text-slate-600 text-xs truncate">{d.author}</div>
                <div className="text-center text-slate-500 text-xs">{d.comments}</div>
                <div className="text-center text-slate-500 text-xs">{d.views.toLocaleString()}</div>
                <div className="text-center text-slate-400 text-xs">{d.daysAgo === 0 ? "오늘" : `${d.daysAgo}일 전`}</div>
              </div>

              {/* Mobile 행 */}
              <div className="md:hidden px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2">
                    {d.isEnded
                      ? <span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5">종료</span>
                      : <span className="bg-pink-100 text-pink-600 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5">진행중</span>
                    }
                    <p className={`text-sm font-medium leading-snug line-clamp-2 flex-1 ${d.isEnded ? "text-slate-400 line-through" : "text-slate-800"}`}>
                      {d.title}
                      {d.comments > 0 && <span className="text-pink-600 font-bold ml-1.5">[{d.comments}]</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-sm font-black text-pink-600">{d.price.toLocaleString()}원</span>
                    <span className="text-[11px] font-bold text-red-500">{d.discount}%↓</span>
                    {d.freeShipping && <span className="text-[10px] font-bold text-emerald-600">무료배송</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                    <span className="font-bold text-slate-500">{d.mall}</span>
                    <span>·</span>
                    <span>{d.author}</span>
                    <span>·</span>
                    <span>조회 {d.views.toLocaleString()}</span>
                  </div>
                </div>
                {d.thumb && (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <Image src={d.thumb} alt="" fill sizes="64px" className={`object-cover ${d.isEnded ? "opacity-50 grayscale" : ""}`} />
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
