import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/navigation";
import { getBoardRows } from "@/data/posts";

type Params = { slug: string };

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const category = CATEGORIES.find((c : any) => c.slug === slug);
  if (!category) notFound();

  const SAMPLE_POSTS = getBoardRows(slug);

  return (
    <div className="space-y-6">
      {/* 브레드크럼 */}
      <nav className="text-xs text-slate-500 flex items-center gap-1.5">
        <Link href="/" className="hover:text-blue-600">홈</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{category.title}</span>
      </nav>

      {/* 헤더 */}
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 ${category.color} rounded-2xl flex items-center justify-center text-2xl shrink-0`}
          >
            {category.icon}
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {category.title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{category.desc}</p>
          </div>
        </div>

        <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          글쓰기
        </button>
      </header>

      {/* 필터·검색 바 */}
      <div className="flex items-center gap-3 flex-wrap justify-between">
        <div className="flex items-center gap-2 overflow-x-auto">
          {["전체", "오늘", "이번주", "인기순", "최신순"].map((f, i) => (
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
            placeholder="게시글 검색"
            className="bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm w-56 focus:outline-none focus:border-blue-400"
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
        <div className="hidden md:grid grid-cols-[72px_1fr_120px_80px_80px_120px] gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500">
          <div className="text-center">썸네일</div>
          <div>제목</div>
          <div className="text-center">작성자</div>
          <div className="text-center">댓글</div>
          <div className="text-center">조회</div>
          <div className="text-center">작성일</div>
        </div>

        <ul className="divide-y divide-slate-100">
          {SAMPLE_POSTS.map((post) => (
            <li key={post.id}>
              <Link
                href={`/posts/${post.id}`}
                className="block hover:bg-slate-50 transition-colors"
              >
                {/* PC 행 */}
                <div className="hidden md:grid grid-cols-[72px_1fr_120px_80px_80px_120px] gap-4 items-center px-5 py-3 text-sm">
                  <div className="flex justify-center">
                    {post.thumb ? (
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                        <Image
                          src={post.thumb}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg bg-slate-50 border border-dashed border-slate-200 flex items-center justify-center text-slate-300 text-xl">
                        ✎
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    {post.isHot && (
                      <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0">
                        HOT
                      </span>
                    )}
                    <span className="text-slate-800 font-medium truncate">{post.title}</span>
                    {post.comments > 0 && (
                      <span className="text-blue-600 text-xs font-bold shrink-0">
                        [{post.comments}]
                      </span>
                    )}
                    {post.isNew && (
                      <span className="text-[10px] font-black text-emerald-500 shrink-0">N</span>
                    )}
                  </div>
                  <div className="text-center text-slate-600 text-xs truncate">{post.author}</div>
                  <div className="text-center text-slate-500 text-xs">{post.comments}</div>
                  <div className="text-center text-slate-500 text-xs">
                    {post.views.toLocaleString()}
                  </div>
                  <div className="text-center text-slate-400 text-xs">
                    {post.daysAgo === 0 ? "오늘" : `${post.daysAgo}일 전`}
                  </div>
                </div>

                {/* Mobile 행 */}
                <div className="md:hidden px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      {post.isHot && (
                        <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                          HOT
                        </span>
                      )}
                      <p className="text-sm text-slate-800 font-medium leading-snug line-clamp-2 flex-1">
                        {post.title}
                        {post.comments > 0 && (
                          <span className="text-blue-600 font-bold ml-1.5">
                            [{post.comments}]
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
                      <span>{post.author}</span>
                      <span>·</span>
                      <span>조회 {post.views.toLocaleString()}</span>
                      <span>·</span>
                      <span>{post.daysAgo === 0 ? "오늘" : `${post.daysAgo}일 전`}</span>
                    </div>
                  </div>
                  {post.thumb && (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                      <Image
                        src={post.thumb}
                        alt=""
                        fill
                        sizes="64px"
                        className="object-cover"
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
              p === 1
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-white"
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
