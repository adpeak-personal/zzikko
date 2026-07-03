import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import SubCategoryTabs from "@/components/category/SubCategoryTabs";
import { CATEGORIES } from "@/config/navigation";
import { categoryMetadata } from "@/lib/seo";

export const metadata = categoryMetadata("community");

export default function CommunityBoardPage() {
  const board = CATEGORIES.find((c) => c.slug === "community");
  const subs = board?.subs ?? [];

  return (
    <div className="space-y-6">
      <CategoryHeader slug="community" cta={<WriteButton label="글쓰기" href="/write?board=community" />} />
      <SubCategoryTabs parentSlug="community" subs={subs} />
      <BoardListClient slug="community" />
      <Pagination />
    </div>
  );
}
