import { notFound } from "next/navigation";
import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import SubCategoryTabs from "@/components/category/SubCategoryTabs";
import { CATEGORIES } from "@/config/navigation";

export default async function FreeBoardSubPage({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;
  const board = CATEGORIES.find((c) => c.slug === "free");
  const subs = board?.subs ?? [];
  const subCat = subs.find((s) => s.slug === sub);
  if (!subCat) notFound();

  return (
    <div className="space-y-6">
      <CategoryHeader
        slug="free"
        cta={<WriteButton label="글쓰기" href={`/write?board=free&sub=${sub}`} />}
      />
      <SubCategoryTabs parentSlug="free" subs={subs} current={sub} />
      <BoardListClient slug="free" subSlug={sub} />
      <Pagination />
    </div>
  );
}
