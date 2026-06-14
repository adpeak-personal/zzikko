import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardList from "@/components/category/BoardList";
import Pagination from "@/components/category/Pagination";
import { getBoardRows } from "@/data/posts";

const POSTS = getBoardRows("online");

export default function OnlinePage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="online" cta={<WriteButton label="시세 등록" />} />
      <CategoryToolbar
        filters={["전체", "KT", "SKT", "LG U+", "알뜰폰"]}
        searchPlaceholder="기종·매장 검색"
      />
      <BoardList posts={POSTS} />
      <Pagination />
    </div>
  );
}
