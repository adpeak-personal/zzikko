import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListServer from "@/components/category/BoardListServer";
import { categoryMetadata } from "@/lib/seo";
import { parsePage } from "@/lib/board";

export const metadata = categoryMetadata("online");

export default async function OnlinePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return (
    <div className="space-y-6">
      <CategoryHeader slug="online" cta={<WriteButton label="시세 등록" />} />
      <CategoryToolbar
        filters={["전체", "KT", "SKT", "LG U+", "알뜰폰"]}
        searchPlaceholder="기종·매장 검색"
      />
      <BoardListServer slug="online" page={parsePage(page)} />
    </div>
  );
}
