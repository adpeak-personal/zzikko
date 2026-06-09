import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardList, { type BoardPost } from "@/components/category/BoardList";
import Pagination from "@/components/category/Pagination";

const SAMPLE_THUMBS = ["/job_default_image.jpg", "/alt_image.jpg", "/profile-base.png", "/logo.png"];

const POSTS: BoardPost[] = Array.from({ length: 15 }).map((_, i) => ({
  id: i + 1,
  title: `${["강남", "홍대", "건대", "잠실", "수원"][i % 5]} 성지 다녀온 후기 — S24 ${i + 1}만원`,
  author: ["리뷰어A", "솔직후기", "구매자B", "체험단", "직접가본"][i % 5],
  comments: (i * 13) % 60,
  views: 300 + ((i * 173) % 8000),
  isHot: i % 4 === 0,
  isNew: i < 3,
  daysAgo: i,
  thumb: i % 3 !== 2 ? SAMPLE_THUMBS[i % SAMPLE_THUMBS.length] : null,
}));

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="reviews" cta={<WriteButton label="후기 작성" />} />
      <CategoryToolbar searchPlaceholder="기종·매장명 검색" />
      <BoardList slug="reviews" posts={POSTS} />
      <Pagination />
    </div>
  );
}
