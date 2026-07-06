import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import BoardListServer from "@/components/category/BoardListServer";
import SubCategoryTabs from "@/components/category/SubCategoryTabs";
import { categoryMetadata } from "@/lib/seo";
import { parsePage } from "@/lib/board";
import { getBoardSubs } from "@/service/board-subs/server";

export const metadata = categoryMetadata("community");

export default async function CommunityBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const subs = await getBoardSubs("community");

  return (
    <div className="space-y-6">
      <CategoryHeader slug="community" cta={<WriteButton label="글쓰기" href="/write?board=community" />} />
      <SubCategoryTabs parentSlug="community" subs={subs} />
      <BoardListServer slug="community" page={parsePage(page)} />
    </div>
  );
}
