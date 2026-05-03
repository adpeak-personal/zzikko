import Image from "next/image";
import Link from "next/link";

export type BoardPost = {
  id: number;
  title: string;
  author: string;
  comments: number;
  views: number;
  isHot?: boolean;
  isNew?: boolean;
  daysAgo: number;
  thumb?: string | null;
  rating?: number;
};

type Props = {
  slug: string;
  posts: BoardPost[];
  showRating?: boolean;
};

export default function BoardList({ slug, posts, showRating = false }: Props) {
  return (
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
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/category/${slug}/${post.id}`}
              className="block hover:bg-slate-50 transition-colors"
            >
              {/* PC 행 */}
              <div className="hidden md:grid grid-cols-[72px_1fr_120px_80px_80px_120px] gap-4 items-center px-5 py-3 text-sm">
                <div className="flex justify-center">
                  {post.thumb ? (
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      <Image src={post.thumb} alt="" fill sizes="56px" className="object-cover" />
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
                  {showRating && post.rating != null && (
                    <span className="text-yellow-500 text-xs font-bold shrink-0">
                      ★ {post.rating.toFixed(1)}
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
                    {showRating && post.rating != null && (
                      <span className="text-yellow-500 text-xs font-bold shrink-0 mt-0.5">
                        ★ {post.rating.toFixed(1)}
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
                    <Image src={post.thumb} alt="" fill sizes="64px" className="object-cover" />
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
