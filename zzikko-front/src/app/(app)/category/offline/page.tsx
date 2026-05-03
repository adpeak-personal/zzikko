import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardList, { type BoardPost } from "@/components/category/BoardList";
import Pagination from "@/components/category/Pagination";

const SAMPLE_THUMBS = ["/job_default_image.jpg", "/alt_image.jpg", "/profile-base.png", "/logo.png"];

const POSTS: BoardPost[] = Array.from({ length: 15 }).map((_, i) => ({
  id: i + 1,
  title: `[${["강남", "홍대", "건대", "잠실", "수원"][i % 5]}] 휴대폰 성지 좌표 공유 #${i + 1}`,
  author: ["성지헌터", "동네성지", "현장방문", "좌표공유", "성지러"][i % 5],
  comments: (i * 9) % 50,
  views: 200 + ((i * 167) % 6000),
  isHot: i % 4 === 0,
  isNew: i < 3,
  daysAgo: i,
  thumb: i % 3 !== 2 ? SAMPLE_THUMBS[i % SAMPLE_THUMBS.length] : null,
}));

export default function OfflinePage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="offline" cta={<WriteButton label="좌표 등록" />} />
      <CategoryToolbar
        filters={[
          "전체",
          "서울",
          "경기",
          "인천",
          "부산",
          "대구",
          "대전",
          "광주",
          "울산",
          "강원",
          "충북",
          "충남",
          "경북",
          "경남",
          "전북",
          "전남",
          "제주",
        ]}
        searchPlaceholder="동·역·매장명 검색"
      />
      <BoardList slug="offline" posts={POSTS} />
      <Pagination />
    </div>
  );
}
