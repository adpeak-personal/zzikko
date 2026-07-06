import { notFound } from "next/navigation";
import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import BoardListServer from "@/components/category/BoardListServer";
import SubCategoryTabs from "@/components/category/SubCategoryTabs";
import { categoryMetadata } from "@/lib/seo";
import { parsePage } from "@/lib/board";
import { getBoardSubs } from "@/service/board-subs/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sub: string }>;
}) {
  const { sub } = await params;
  const subs = await getBoardSubs("community");
  const subCat = subs.find((s) => s.slug === sub);
  return categoryMetadata("community", sub, subCat?.title);
}

export default async function CommunityBoardSubPage({
  params,
  searchParams,
}: {
  params: Promise<{ sub: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ sub }, { page }] = await Promise.all([params, searchParams]);
  const subs = await getBoardSubs("community");
  const subCat = subs.find((s) => s.slug === sub);
  if (!subCat) notFound();

  return (
    <div className="space-y-6">
      <CategoryHeader
        slug="community"
        cta={<WriteButton label="글쓰기" href={`/write?board=community&sub=${sub}`} />}
      />
      <SubCategoryTabs parentSlug="community" subs={subs} current={sub} />
      <BoardListServer slug="community" subSlug={sub} page={parsePage(page)} />
    </div>
  );
}
