import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/navigation";
import { getPostDetailCached } from "@/service/posts/server";
import { nestComments } from "@/lib/utils";
import PostContent from "@/components/common/PostContent";
import PostBreadcrumb from "@/components/posts/PostBreadcrumb";
import PostOwnerActions from "@/components/posts/PostOwnerActions";
import PostHeader from "@/components/posts/PostHeader";
import PostActions from "@/components/posts/PostActions";
import PostComments from "@/components/posts/PostComments";
import PostNav from "@/components/posts/PostNav";
import PostJsonLd from "@/components/posts/PostJsonLd";
import { postMetadata } from "@/lib/seo";

const SLUG = "free";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPostDetailCached(Number(id));
  return postMetadata(post, SLUG);
}

export default async function FreePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPostDetailCached(Number(id));
  if (!post) notFound();

  const board = CATEGORIES.find((c) => c.slug === SLUG);
  const sub = board?.subs?.find((s) => s.slug === post.sub_slug);
  const comments = nestComments(post.comments);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3">
        <PostBreadcrumb board={board} title={post.title} />
        <PostOwnerActions postId={post.id} authorId={post.user_id} boardSlug={post.board_slug} />
      </div>

      {sub && (
        <div className="text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-md font-bold">
            {sub.icon && <span>{sub.icon}</span>}
            {sub.title}
          </span>
        </div>
      )}

      <PostJsonLd post={post} />

      <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <PostHeader post={post} board={board} />
        <PostContent
          html={post.content}
          className="px-6 py-6 prose prose-slate max-w-none text-[15px] leading-relaxed"
        />
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
