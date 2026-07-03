import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import { categoryMetadata } from "@/lib/seo";

export const metadata = categoryMetadata("reviews");

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="reviews" cta={<WriteButton label="후기 작성" />} />
      <CategoryToolbar searchPlaceholder="기종·매장명 검색" />
      <BoardListClient slug="reviews" showRating />
      <Pagination />
    </div>
  );
}
