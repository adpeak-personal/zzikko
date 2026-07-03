import { notFound } from "next/navigation";
import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import SubCategoryTabs from "@/components/category/SubCategoryTabs";
import { CATEGORIES } from "@/config/navigation";
import { categoryMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;
  return categoryMetadata("community", sub);
}

export default async function CommunityBoardSubPage({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;
  const board = CATEGORIES.find((c) => c.slug === "community");
  const subs = board?.subs ?? [];
  const subCat = subs.find((s) => s.slug === sub);
  if (!subCat) notFound();

  return (
    <div className="space-y-6">
      <CategoryHeader
        slug="community"
        cta={<WriteButton label="글쓰기" href={`/write?board=community&sub=${sub}`} />}
      />
      <SubCategoryTabs parentSlug="community" subs={subs} current={sub} />
      <BoardListClient slug="community" subSlug={sub} />
      <Pagination />
    </div>
  );
}
