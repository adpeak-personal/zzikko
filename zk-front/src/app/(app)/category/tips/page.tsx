import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardList, { type BoardPost } from "@/components/category/BoardList";
import Pagination from "@/components/category/Pagination";

const SAMPLE_THUMBS = ["/job_default_image.jpg", "/alt_image.jpg", "/profile-base.png", "/logo.png"];

const POSTS: BoardPost[] = Array.from({ length: 15 }).map((_, i) => ({
  id: i + 1,
  title: `[꿀팁] 호갱 안 되는 성지 가는 법 #${i + 1}`,
  author: ["꿀팁장인", "성지마스터", "절약왕", "통신박사", "현금왕"][i % 5],
  comments: (i * 7) % 53,
  views: 100 + ((i * 137) % 5000),
  isHot: i % 5 === 0,
  isNew: i < 3,
  daysAgo: i,
  thumb: i % 3 !== 2 ? SAMPLE_THUMBS[i % SAMPLE_THUMBS.length] : null,
}));

export default function TipsPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="tips" cta={<WriteButton />} />
      <CategoryToolbar />
      <BoardList slug="tips" posts={POSTS} />
      <Pagination />
    </div>
  );
}
