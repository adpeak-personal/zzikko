import { getBoardPostsCached } from "@/service/posts/server";
import { POSTS_PER_PAGE } from "@/lib/board";
import BoardList from "./BoardList";
import Pagination from "./Pagination";

type Props = {
  slug: string;
  subSlug?: string;
  showRating?: boolean;
  page?: number;
};

export default async function BoardListServer({
  slug,
  subSlug,
  showRating,
  page = 1,
}: Props) {
  const data = await getBoardPostsCached(slug, page, POSTS_PER_PAGE, subSlug);

  if (!data) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm text-red-400">
        게시글을 불러오지 못했어요. 잠시 후 다시 시도해주세요.
      </div>
    );
  }

  const basePath = subSlug
    ? `/category/${slug}/${subSlug}`
    : `/category/${slug}`;

  if (data.data.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-sm text-slate-400">
        아직 게시글이 없어요.
      </div>
    );
  }

  // 서버 컴포넌트 — 요청당 1회 렌더이므로 Date.now() 는 안정적. purity 룰은 클라이언트 훅 대상.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const posts = data.data.map((p) => ({
    id: p.id,
    title: p.title,
    author: p.author ?? "익명",
    comments: p.comment_count,
    views: p.views,
    thumb: p.thumb,
    daysAgo: Math.floor(
      (now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24),
    ),
  }));

  return (
    <div className="space-y-6">
      <BoardList slug={slug} posts={posts} showRating={showRating} />
      <Pagination
        basePath={basePath}
        currentPage={data.meta.page}
        totalPages={data.meta.totalPages}
      />
    </div>
  );
}
