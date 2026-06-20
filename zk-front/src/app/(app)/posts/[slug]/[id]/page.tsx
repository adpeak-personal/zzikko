import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/navigation";
import { fetchPostDetail } from "@/service/posts/api";
import { nestComments, formatDate, daysAgo } from "@/lib/utils";
import type { HotdealExtra, NestedComment } from "@/service/posts/types";

type Params = { slug: string; id: string };

export default async function PostDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug, id } = await params;
  const post = await fetchPostDetail(Number(id));
  if (!post) notFound();

  const board = CATEGORIES.find((c) => c.slug === slug);
  const comments = nestComments(post.comments);
  const deal = post.board_slug === "hotdeal" ? (post.extra_data as HotdealExtra | null) : null;
  const tags: string[] = (post.extra_data as any)?.tags ?? [];
  const isHot = post.like_count >= 10;
  const avatar = post.author_profile_image ?? `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(post.author)}`;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 브레드크럼 */}
      <nav className="text-xs text-slate-500 flex items-center gap-1.5">
        <Link href="/" className="hover:text-pink-600">홈</Link>
        <span>/</span>
        {board && (
          <>
            <Link href={`/category/${board.slug}`} className="hover:text-pink-600">
              {board.title}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-slate-700 font-medium truncate max-w-[160px]">{post.title}</span>
      </nav>

      {/* 본문 카드 */}
      <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* 제목 영역 */}
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

        {/* 딜 정보 박스 (핫딜 전용) */}
        {deal && (
          <div className="mx-6 mt-5 rounded-2xl border border-pink-100 bg-pink-50/50 p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {deal.mall}
                  </span>
                  {deal.free_shipping && (
                    <span className="text-[11px] font-bold text-emerald-600">무료배송</span>
                  )}
                  {deal.is_ended ? (
                    <span className="text-[11px] font-bold text-slate-500">종료된 딜</span>
                  ) : (
                    <span className="text-[11px] font-bold text-pink-600">진행중 · ~{deal.ends_at}</span>
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-pink-600">
                    {deal.price.toLocaleString()}원
                  </span>
                  <span className="text-sm text-slate-400 line-through mb-1">
                    {deal.original_price.toLocaleString()}원
                  </span>
                  <span className="text-sm font-black text-red-500 mb-1">
                    {deal.discount_rate}%↓
                  </span>
                </div>
              </div>
              <a
                href={deal.deal_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`shrink-0 text-sm font-bold px-5 py-3 rounded-xl transition-colors flex items-center gap-1.5 ${
                  deal.is_ended
                    ? "bg-slate-200 text-slate-500 pointer-events-none"
                    : "bg-pink-600 hover:bg-pink-500 text-white"
                }`}
              >
                최저가 보러가기
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* 본문 */}
        <div
          className="px-6 py-6 prose prose-slate max-w-none text-[15px] leading-relaxed"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* 태그 */}
        {tags.length > 0 && (
          <div className="px-6 pb-4 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* 좋아요 / 공유 액션 바 */}
        <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-center gap-3">
          <button className="flex items-center gap-2 bg-pink-50 hover:bg-pink-100 text-pink-600 font-bold px-6 py-2.5 rounded-xl transition-colors">
            <span>❤️</span>
            <span className="text-sm">좋아요 {post.like_count}</span>
          </button>
          <button className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold px-5 py-2.5 rounded-xl transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>공유</span>
          </button>
          <button className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-400 font-bold px-5 py-2.5 rounded-xl transition-colors text-sm">
            신고
          </button>
        </div>
      </article>

      {/* 댓글 섹션 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-base font-extrabold text-slate-900 mb-4">
          댓글 <span className="text-pink-600">{post.comment_count}</span>
        </h2>

        {/* 댓글 입력 */}
        <div className="mb-6">
          <textarea
            placeholder="댓글을 입력하세요"
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-pink-400 focus:bg-white transition-colors"
          />
          <div className="flex justify-end mt-2">
            <button className="bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors">
              등록
            </button>
          </div>
        </div>

        {/* 댓글 리스트 */}
        {comments.length > 0 ? (
          <ul className="space-y-5">
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 text-center py-6">
            아직 댓글이 없어요. 첫 댓글을 남겨보세요!
          </p>
        )}
      </section>

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-between">
        <Link
          href={board ? `/category/${board.slug}` : "/"}
          className="text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          목록
        </Link>

        <div className="flex items-center gap-2">
          {post.prev_id !== null ? (
            <Link
              href={`/posts/${post.board_slug}/${post.prev_id}`}
              className="text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-xl transition-colors"
            >
              ‹ 이전글
            </Link>
          ) : (
            <span className="text-sm font-medium text-slate-300 bg-white border border-slate-100 px-4 py-2.5 rounded-xl cursor-not-allowed">
              ‹ 이전글
            </span>
          )}
          {post.next_id !== null ? (
            <Link
              href={`/posts/${post.board_slug}/${post.next_id}`}
              className="text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-xl transition-colors"
            >
              다음글 ›
            </Link>
          ) : (
            <span className="text-sm font-medium text-slate-300 bg-white border border-slate-100 px-4 py-2.5 rounded-xl cursor-not-allowed">
              다음글 ›
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CommentItem({ comment }: { comment: NestedComment }) {
  const avatar = comment.author_profile_image
    ?? `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(comment.author)}`;
  const ago = daysAgo(comment.created_at);

  return (
    <li>
      <div className="flex gap-3">
        <div
          className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 shrink-0"
          style={{ backgroundImage: `url(${avatar})`, backgroundSize: "cover" }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">{comment.author}</span>
            <span className="text-[11px] text-slate-400">
              {ago === 0 ? "오늘" : `${ago}일 전`}
            </span>
          </div>
          <p className="text-sm text-slate-700 mt-1 leading-relaxed">{comment.content}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
            <button className="hover:text-pink-600 font-medium">❤️ {comment.like_count}</button>
            <button className="hover:text-pink-600 font-medium">답글</button>
          </div>

          {/* 대댓글 */}
          {comment.replies.length > 0 && (
            <ul className="mt-4 space-y-4 pl-4 border-l-2 border-slate-100">
              {comment.replies.map((r) => (
                <ReplyItem key={r.id} reply={r} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

function ReplyItem({ reply }: { reply: NestedComment }) {
  const avatar = reply.author_profile_image
    ?? `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(reply.author)}`;
  const ago = daysAgo(reply.created_at);

  return (
    <li className="flex gap-3">
      <div
        className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 shrink-0"
        style={{ backgroundImage: `url(${avatar})`, backgroundSize: "cover" }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-800">{reply.author}</span>
          <span className="text-[11px] text-slate-400">
            {ago === 0 ? "오늘" : `${ago}일 전`}
          </span>
        </div>
        <p className="text-sm text-slate-700 mt-1 leading-relaxed">{reply.content}</p>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
          <button className="hover:text-pink-600 font-medium">❤️ {reply.like_count}</button>
        </div>
      </div>
    </li>
  );
}
