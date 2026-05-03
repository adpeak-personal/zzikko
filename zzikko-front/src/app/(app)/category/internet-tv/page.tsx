import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardList, { type BoardPost } from "@/components/category/BoardList";
import Pagination from "@/components/category/Pagination";

const SAMPLE_THUMBS = ["/job_default_image.jpg", "/alt_image.jpg", "/profile-base.png", "/logo.png"];

const POSTS: BoardPost[] = Array.from({ length: 15 }).map((_, i) => ({
  id: i + 1,
  title: `[${["KT", "SKB", "LG U+", "결합", "알뜰"][i % 5]}] 인터넷+TV 현금 사은품 ${30 + i * 2}만원`,
  author: ["인터넷장인", "결합왕", "기가매니아", "사은품킹", "TV박사"][i % 5],
  comments: (i * 11) % 45,
  views: 300 + ((i * 179) % 5500),
  isHot: i % 4 === 0,
  isNew: i < 3,
  daysAgo: i,
  thumb: i % 3 !== 2 ? SAMPLE_THUMBS[i % SAMPLE_THUMBS.length] : null,
}));

export default function InternetTvPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="internet-tv" cta={<WriteButton label="혜택 등록" />} />
      <CategoryToolbar
        filters={["전체", "KT", "SKB", "LG U+", "알뜰", "결합"]}
        searchPlaceholder="통신사·요금제 검색"
      />
      <BoardList slug="internet-tv" posts={POSTS} />
      <Pagination />
    </div>
  );
}
