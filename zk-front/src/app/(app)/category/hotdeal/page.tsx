import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import HotdealListClient from "@/components/category/HotdealListClient";
import Pagination from "@/components/category/Pagination";
import { categoryMetadata } from "@/lib/seo";

export const metadata = categoryMetadata("hotdeal");

export default function HotdealPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="hotdeal" cta={<WriteButton label="핫딜 등록하기" href="/write" />} />
      <CategoryToolbar
        filters={["🔥 전체", "진행중", "무료배송", "인기순", "최신순"]}
        searchPlaceholder="핫딜 검색"
      />
      <HotdealListClient />
      <Pagination />
    </div>
  );
}
