import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { CategoryNav } from "@/config/navigation";
import type { PostDetail } from "@/service/posts/types";

export default function PostHeader({
  post,
  board,
}: {
  post: PostDetail;
  board?: CategoryNav;
}) {
  const isHot = post.like_count >= 10;
  const avatar =
    post.author_profile_image ??
    `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(post.author)}`;

  return (
    <header className="px-6 pt-6 pb-5 border-b border-slate-100">
      <div className="flex items-center gap-2 mb-3">
        {board && (
          <Link
            href={`/category/${board.slug}`}
            className={`text-[11px] font-bold ${board.color} ${board.text} px-2 py-0.5 rounded-full`}
          >
            {board.icon} {board.title}
          </Link>
        )}
        {isHot && (
          <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full">
            HOT
          </span>
        )}
      </div>

      <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-snug">
        {post.title}
      </h1>

      {/* 작성자 / 메타 */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0"
            style={{ backgroundImage: `url(${avatar})`, backgroundSize: "cover" }}
          />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-slate-800">{post.author}</span>
              <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                {post.level ?? "BRONZE"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(post.created_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span>조회 {post.view_count.toLocaleString()}</span>
          <span>·</span>
          <span>댓글 {post.comment_count}</span>
        </div>
      </div>
    </header>
  );
}
