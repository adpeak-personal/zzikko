import Image from "next/image";
import Link from "next/link";
import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import { getBoardPosts } from "@/data/posts";

// 목록/상세 공용 단일 소스에서 핫딜 글을 가져와 행 형태로 매핑
const DEALS = getBoardPosts("hotdeal").map((p) => ({
  id: p.id,
  mall: p.deal!.mall,
  title: p.title,
  price: p.deal!.price,
  discount: p.deal!.discountRate,
  freeShipping: p.deal!.freeShipping,
  isEnded: p.deal!.isEnded,
  isHot: p.isHot,
  isNew: p.isNew,
  comments: p.commentCount,
  views: p.views,
  author: p.author.nickname,
  daysAgo: p.daysAgo,
  thumb: p.thumb,
}));

export default function HotdealPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="hotdeal" cta={<WriteButton label="핫딜 제보" />} />

      {/* 필터·검색 바 */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["🔥 전체", "진행중", "무료배송", "인기순", "최신순"].map((f, i) => (
            <button
              key={f}
              className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                i === 0
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="핫딜 검색"
            className="bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm w-48 focus:outline-none focus:border-pink-400"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* 게시판 리스트 */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* PC 헤더 */}
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
          {DEALS.map((d) => (
            <li key={d.id}>
              <Link
                href={`/posts/${d.id}`}
                className="block hover:bg-pink-50/40 transition-colors"
              >
                {/* PC 행 */}
                <div className="hidden md:grid grid-cols-[72px_80px_1fr_110px_90px_70px_70px_90px] gap-4 items-center px-5 py-3 text-sm">
                  <div className="flex justify-center">
                    {d.thumb ? (
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                        <Image
                          src={d.thumb}
                          alt=""
                          fill
                          sizes="56px"
                          className={`object-cover ${d.isEnded ? "opacity-50 grayscale" : ""}`}
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-xl">
                        🏷️
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {d.mall}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    {d.isEnded ? (
                      <span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                        종료
                      </span>
                    ) : (
                      <span className="bg-pink-100 text-pink-600 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                        진행중
                      </span>
                    )}
                    {d.isHot && (
                      <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                        HOT
                      </span>
                    )}
                    <span
                      className={`font-medium truncate ${
                        d.isEnded ? "text-slate-400 line-through" : "text-slate-800"
                      }`}
                    >
                      {d.title}
                    </span>
                    {d.freeShipping && (
                      <span className="text-[10px] font-bold text-emerald-600 shrink-0">
                        무료배송
                      </span>
                    )}
                    {d.comments > 0 && (
                      <span className="text-pink-600 text-xs font-bold shrink-0">
                        [{d.comments}]
                      </span>
                    )}
                    {d.isNew && (
                      <span className="text-[10px] font-black text-emerald-500 shrink-0">N</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-pink-600">
                      {d.price.toLocaleString()}원
                    </span>
                    <span className="block text-[10px] font-bold text-red-500">
                      {d.discount}%↓
                    </span>
                  </div>
                  <div className="text-center text-slate-600 text-xs truncate">{d.author}</div>
                  <div className="text-center text-slate-500 text-xs">{d.comments}</div>
                  <div className="text-center text-slate-500 text-xs">
                    {d.views.toLocaleString()}
                  </div>
                  <div className="text-center text-slate-400 text-xs">
                    {d.daysAgo === 0 ? "오늘" : `${d.daysAgo}일 전`}
                  </div>
                </div>

                {/* Mobile 행 */}
                <div className="md:hidden px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      {d.isEnded ? (
                        <span className="bg-slate-200 text-slate-500 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                          종료
                        </span>
                      ) : (
                        <span className="bg-pink-100 text-pink-600 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                          진행중
                        </span>
                      )}
                      <p
                        className={`text-sm font-medium leading-snug line-clamp-2 flex-1 ${
                          d.isEnded ? "text-slate-400 line-through" : "text-slate-800"
                        }`}
                      >
                        {d.title}
                        {d.comments > 0 && (
                          <span className="text-pink-600 font-bold ml-1.5">[{d.comments}]</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm font-black text-pink-600">
                        {d.price.toLocaleString()}원
                      </span>
                      <span className="text-[11px] font-bold text-red-500">{d.discount}%↓</span>
                      {d.freeShipping && (
                        <span className="text-[10px] font-bold text-emerald-600">무료배송</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                      <span className="font-bold text-slate-500">{d.mall}</span>
                      <span>·</span>
                      <span>{d.author}</span>
                      <span>·</span>
                      <span>조회 {d.views.toLocaleString()}</span>
                      <span>·</span>
                      <span>{d.daysAgo === 0 ? "오늘" : `${d.daysAgo}일 전`}</span>
                    </div>
                  </div>
                  {d.thumb && (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <Image
                        src={d.thumb}
                        alt=""
                        fill
                        sizes="64px"
                        className={`object-cover ${d.isEnded ? "opacity-50 grayscale" : ""}`}
                      />
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* 페이지네이션 */}
      <div className="flex items-center justify-center gap-1 pt-2">
        <button className="w-9 h-9 rounded-lg text-slate-400 hover:bg-white">‹</button>
        {[1, 2, 3, 4, 5].map((p) => (
          <button
            key={p}
            className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
              p === 1 ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white"
            }`}
          >
            {p}
          </button>
        ))}
        <button className="w-9 h-9 rounded-lg text-slate-400 hover:bg-white">›</button>
      </div>
    </div>
  );
}
