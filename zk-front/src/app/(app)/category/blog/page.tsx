import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import { categoryMetadata } from "@/lib/seo";

export const metadata = categoryMetadata("blog");

export default function BlogPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="blog" cta={<WriteButton label="글쓰기" href="/write?board=blog" />} />
      <CategoryToolbar />
      <BoardListClient slug="blog" />
      <Pagination />
    </div>
  );
}
