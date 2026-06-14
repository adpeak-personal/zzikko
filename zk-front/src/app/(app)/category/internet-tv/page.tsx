import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardList from "@/components/category/BoardList";
import Pagination from "@/components/category/Pagination";
import { getBoardRows } from "@/data/posts";

const POSTS = getBoardRows("internet-tv");

export default function InternetTvPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="internet-tv" cta={<WriteButton label="혜택 등록" />} />
      <CategoryToolbar
        filters={["전체", "KT", "SKB", "LG U+", "알뜰", "결합"]}
        searchPlaceholder="통신사·요금제 검색"
      />
      <BoardList posts={POSTS} />
      <Pagination />
    </div>
  );
}
