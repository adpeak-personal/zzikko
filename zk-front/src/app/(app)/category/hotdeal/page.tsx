import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import HotdealListServer from "@/components/category/HotdealListServer";
import { categoryMetadata } from "@/lib/seo";
import { parsePage } from "@/lib/board";

export const metadata = categoryMetadata("hotdeal");

export default async function HotdealPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return (
    <div className="space-y-6">
      <CategoryHeader slug="hotdeal" cta={<WriteButton label="핫딜 등록하기" href="/write" />} />
      <CategoryToolbar
        filters={["🔥 전체", "진행중", "무료배송", "인기순", "최신순"]}
        searchPlaceholder="핫딜 검색"
      />
      <HotdealListServer page={parsePage(page)} />
    </div>
  );
}
