import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import SubCategoryTabs from "@/components/category/SubCategoryTabs";
import { CATEGORIES } from "@/config/navigation";
import { categoryMetadata } from "@/lib/seo";

export const metadata = categoryMetadata("free");

export default function FreeBoardPage() {
  const board = CATEGORIES.find((c) => c.slug === "free");
  const subs = board?.subs ?? [];

  return (
    <div className="space-y-6">
      <CategoryHeader slug="free" cta={<WriteButton label="글쓰기" href="/write?board=free" />} />
      <SubCategoryTabs parentSlug="free" subs={subs} />
      <BoardListClient slug="free" />
      <Pagination />
    </div>
  );
}
