import Link from "next/link";
import type { CategoryNav } from "@/config/navigation";

export default function PostNav({
  board,
  boardSlug,
  prevId,
  nextId,
}: {
  board?: CategoryNav;
  boardSlug: string;
  prevId: number | null;
  nextId: number | null;
}) {
  return (
    <div className="flex items-center justify-between">
      <Link
        href={board ? `/category/${board.slug}` : "/"}
        className="text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
        목록
      </Link>

      <div className="flex items-center gap-2">
        {prevId !== null ? (
          <Link
            href={`/posts/${boardSlug}/${prevId}`}
            className="text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-xl transition-colors"
          >
            ‹ 이전글
          </Link>
        ) : (
          <span className="text-sm font-medium text-slate-300 bg-white border border-slate-100 px-4 py-2.5 rounded-xl cursor-not-allowed">
            ‹ 이전글
          </span>
        )}
        {nextId !== null ? (
          <Link
            href={`/posts/${boardSlug}/${nextId}`}
            className="text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-xl transition-colors"
          >
            다음글 ›
          </Link>
        ) : (
          <span className="text-sm font-medium text-slate-300 bg-white border border-slate-100 px-4 py-2.5 rounded-xl cursor-not-allowed">
            다음글 ›
          </span>
        )}
      </div>
    </div>
  );
}
