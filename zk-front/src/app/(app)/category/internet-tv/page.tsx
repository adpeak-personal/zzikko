import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListServer from "@/components/category/BoardListServer";
import { categoryMetadata } from "@/lib/seo";
import { parsePage } from "@/lib/board";

export const metadata = categoryMetadata("internet-tv");

export default async function InternetTvPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  return (
    <div className="space-y-6">
      <CategoryHeader slug="internet-tv" cta={<WriteButton label="혜택 등록" />} />
      <CategoryToolbar
        filters={["전체", "KT", "SKB", "LG U+", "알뜰", "결합"]}
        searchPlaceholder="통신사·요금제 검색"
      />
      <BoardListServer slug="internet-tv" page={parsePage(page)} />
    </div>
  );
}
