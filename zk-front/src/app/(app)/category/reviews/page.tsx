import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import SubCategoryTabs from "@/components/category/SubCategoryTabs";
import { categoryMetadata } from "@/lib/seo";
import { getBoardSubs } from "@/service/board-subs/server";

export const metadata = categoryMetadata("reviews");

export default async function ReviewsPage() {
  const subs = await getBoardSubs("reviews");

  return (
    <div className="space-y-6">
      <CategoryHeader slug="reviews" cta={<WriteButton label="후기 작성" />} />
      <CategoryToolbar searchPlaceholder="기종·매장명 검색" />
      {subs.length > 0 && <SubCategoryTabs parentSlug="reviews" subs={subs} />}
      <BoardListClient slug="reviews" showRating />
      <Pagination />
    </div>
  );
}
