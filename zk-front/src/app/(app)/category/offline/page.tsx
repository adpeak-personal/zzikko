import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";

export default function OfflinePage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="offline" cta={<WriteButton label="좌표 등록" />} />
      <CategoryToolbar
        filters={["전체","서울","경기","인천","부산","대구","대전","광주","울산","강원","충북","충남","경북","경남","전북","전남","제주"]}
        searchPlaceholder="동·역·매장명 검색"
      />
      <BoardListClient slug="offline" />
      <Pagination />
    </div>
  );
}
