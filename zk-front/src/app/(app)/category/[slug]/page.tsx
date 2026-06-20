import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/navigation";
import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";

type Params = { slug: string };

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const category = CATEGORIES.find((c: any) => c.slug === slug);
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <CategoryHeader slug={slug} cta={<WriteButton />} />
      <CategoryToolbar />
      <BoardListClient slug={slug} />
      <Pagination />
    </div>
  );
}
