"use client";

import { useBoardPosts } from "@/service/posts";
import BoardList from "./BoardList";

type Props = {
  slug: string;
  subSlug?: string;
  showRating?: boolean;
};

export default function BoardListClient({ slug, subSlug, showRating }: Props) {
  const { data, isPending, isError } = useBoardPosts(slug, 1, subSlug);

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

  const posts = data.data.map((p) => ({
    id: p.id,
    title: p.title,
    author: p.author ?? "익명",
    comments: p.comment_count,
    views: p.views,
    thumb: p.thumb,
    daysAgo: Math.floor(
      (Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24),
    ),
  }));

  if (posts.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm text-slate-400">
        아직 게시글이 없어요.
      </div>
    );
  }

  return <BoardList slug={slug} posts={posts} showRating={showRating} />;
}
