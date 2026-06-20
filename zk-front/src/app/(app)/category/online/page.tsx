import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";

export default function OnlinePage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="online" cta={<WriteButton label="시세 등록" />} />
      <CategoryToolbar
        filters={["전체", "KT", "SKT", "LG U+", "알뜰폰"]}
        searchPlaceholder="기종·매장 검색"
      />
      <BoardListClient slug="online" />
      <Pagination />
    </div>
  );
}
