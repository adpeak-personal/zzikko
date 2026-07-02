import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardListClient from "@/components/category/BoardListClient";
import Pagination from "@/components/category/Pagination";
import { categoryMetadata } from "@/lib/seo";

export const metadata = categoryMetadata("tips");

export default function TipsPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="tips" cta={<WriteButton />} />
      <CategoryToolbar />
      <BoardListClient slug="tips" />
      <Pagination />
    </div>
  );
}
