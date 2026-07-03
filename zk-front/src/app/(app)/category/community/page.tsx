import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import SubCategoryTabs from "@/components/category/SubCategoryTabs";
import { categoryMetadata } from "@/lib/seo";
import { getBoardSubs } from "@/service/board-subs/server";

export const metadata = categoryMetadata("community");

export default async function CommunityBoardPage() {
  const subs = await getBoardSubs("community");

  return (
    <div className="space-y-6">
      <CategoryHeader slug="community" cta={<WriteButton label="글쓰기" href="/write?board=community" />} />
      <SubCategoryTabs parentSlug="community" subs={subs} />
      <BoardListClient slug="community" />
      <Pagination />
    </div>
  );
}
