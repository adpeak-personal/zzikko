import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import BoardList from "@/components/category/BoardList";
import Pagination from "@/components/category/Pagination";
import { getBoardRows } from "@/data/posts";

const POSTS = getBoardRows("tips");

export default function TipsPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="tips" cta={<WriteButton />} />
      <CategoryToolbar />
      <BoardList posts={POSTS} />
      <Pagination />
    </div>
  );
}
