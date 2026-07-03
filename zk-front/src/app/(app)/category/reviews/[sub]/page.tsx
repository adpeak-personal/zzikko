import { notFound } from "next/navigation";
import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import SubCategoryTabs from "@/components/category/SubCategoryTabs";
import { categoryMetadata } from "@/lib/seo";
import { getBoardSubs } from "@/service/board-subs/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;
  const subs = await getBoardSubs("reviews");
  const subCat = subs.find((s) => s.slug === sub);
  return categoryMetadata("reviews", sub, subCat?.title);
}

export default async function ReviewsSubPage({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;
  const subs = await getBoardSubs("reviews");
  const subCat = subs.find((s) => s.slug === sub);
  if (!subCat) notFound();

  return (
    <div className="space-y-6">
      <CategoryHeader
        slug="reviews"
        cta={<WriteButton label="후기 작성" href={`/write?board=reviews&sub=${sub}`} />}
      />
      <CategoryToolbar searchPlaceholder="기종·매장명 검색" />
      <SubCategoryTabs parentSlug="reviews" subs={subs} current={sub} />
      <BoardListClient slug="reviews" subSlug={sub} showRating />
      <Pagination />
    </div>
  );
}
