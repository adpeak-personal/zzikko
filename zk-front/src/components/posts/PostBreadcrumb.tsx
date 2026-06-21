import Link from "next/link";
import type { CategoryNav } from "@/config/navigation";

export default function PostBreadcrumb({
  board,
  title,
}: {
  board?: CategoryNav;
  title: string;
}) {
  return (
    <nav className="text-xs text-slate-500 flex items-center gap-1.5">
      <Link href="/" className="hover:text-pink-600">홈</Link>
      <span>/</span>
      {board && (
        <>
          <Link href={`/category/${board.slug}`} className="hover:text-pink-600">
            {board.title}
          </Link>
          <span>/</span>
        </>
      )}
      <span className="text-slate-700 font-medium truncate max-w-[160px]">{title}</span>
    </nav>
  );
}
