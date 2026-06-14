import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardList from "@/components/category/BoardList";
import Pagination from "@/components/category/Pagination";
import { getBoardRows } from "@/data/posts";

const POSTS = getBoardRows("reviews");

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="reviews" cta={<WriteButton label="후기 작성" />} />
      <CategoryToolbar searchPlaceholder="기종·매장명 검색" />
      <BoardList posts={POSTS} showRating />
      <Pagination />
    </div>
  );
}
