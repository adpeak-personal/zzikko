import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";

export default function InternetTvPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="internet-tv" cta={<WriteButton label="혜택 등록" />} />
      <CategoryToolbar
        filters={["전체", "KT", "SKB", "LG U+", "알뜰", "결합"]}
        searchPlaceholder="통신사·요금제 검색"
      />
      <BoardListClient slug="internet-tv" />
      <Pagination />
    </div>
  );
}
