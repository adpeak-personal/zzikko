import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardList, { type BoardPost } from "@/components/category/BoardList";
import Pagination from "@/components/category/Pagination";

const SAMPLE_THUMBS = ["/job_default_image.jpg", "/alt_image.jpg", "/profile-base.png", "/logo.png"];

const POSTS: BoardPost[] = Array.from({ length: 15 }).map((_, i) => ({
  id: i + 1,
  title: `[온라인 성지] 갤럭시 S24 자급제급 가격 ${i + 1}호점`,
  author: ["온라인공구", "전국비대면", "당일개통", "온라인장인", "톡상담"][i % 5],
  comments: (i * 11) % 47,
  views: 200 + ((i * 211) % 7000),
  isHot: i % 4 === 0,
  isNew: i < 3,
  daysAgo: i,
  thumb: i % 3 !== 2 ? SAMPLE_THUMBS[i % SAMPLE_THUMBS.length] : null,
}));

export default function OnlinePage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="online" cta={<WriteButton label="시세 등록" />} />
      <CategoryToolbar
        filters={["전체", "KT", "SKT", "LG U+", "알뜰폰"]}
        searchPlaceholder="기종·매장 검색"
      />
      <BoardList slug="online" posts={POSTS} />
      <Pagination />
    </div>
  );
}
