import { daysAgo } from "@/lib/utils";
import type { NestedComment } from "@/service/posts/types";

export default function PostComments({
  comments,
  commentCount,
}: {
  comments: NestedComment[];
  commentCount: number;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6">
      <h2 className="text-base font-extrabold text-slate-900 mb-4">
        댓글 <span className="text-pink-600">{commentCount}</span>
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
