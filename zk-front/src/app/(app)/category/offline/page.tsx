import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListServer from "@/components/category/BoardListServer";
import { categoryMetadata } from "@/lib/seo";
import { parsePage } from "@/lib/board";

export const metadata = categoryMetadata("offline");

export default async function OfflinePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return (
    <div className="space-y-6">
      <CategoryHeader slug="offline" cta={<WriteButton label="좌표 등록" />} />
      <CategoryToolbar
        filters={["전체","서울","경기","인천","부산","대구","대전","광주","울산","강원","충북","충남","경북","경남","전북","전남","제주"]}
        searchPlaceholder="동·역·매장명 검색"
      />
      <BoardListServer slug="offline" page={parsePage(page)} />
    </div>
  );
}
