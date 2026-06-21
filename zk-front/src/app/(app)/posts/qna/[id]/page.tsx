import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/navigation";
import { fetchPostDetail } from "@/service/posts/api";
import { nestComments } from "@/lib/utils";
import PostContent from "@/components/common/PostContent";
import PostBreadcrumb from "@/components/posts/PostBreadcrumb";
import PostOwnerActions from "@/components/posts/PostOwnerActions";
import PostHeader from "@/components/posts/PostHeader";
import PostActions from "@/components/posts/PostActions";
import PostComments from "@/components/posts/PostComments";
import PostNav from "@/components/posts/PostNav";

const SLUG = "qna";

export default async function QnaPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await fetchPostDetail(Number(id));
  if (!post) notFound();

  const board = CATEGORIES.find((c) => c.slug === SLUG);
  const comments = nestComments(post.comments);
  const tags: string[] = (post.extra_data as any)?.tags ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <PostBreadcrumb board={board} title={post.title} />
        <PostOwnerActions postId={post.id} authorId={post.user_id} boardSlug={post.board_slug} />
      </div>

      <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <PostHeader post={post} board={board} />

        <PostContent
          html={post.content}
          className="px-6 py-6 prose prose-slate max-w-none text-[15px] leading-relaxed"
        />

        {tags.length > 0 && (
          <div className="px-6 pb-4 flex flex-wrap gap-2">
            {tags.map((t) => (
              <span key={t} className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                #{t}
              </span>
            ))}
          </div>
        )}

        <PostActions likeCount={post.like_count} />
      </article>

      <PostComments comments={comments} commentCount={post.comment_count} />

      <PostNav
        board={board}
        boardSlug={post.board_slug}
        prevId={post.prev_id}
        nextId={post.next_id}
      />
    </div>
  );
}
