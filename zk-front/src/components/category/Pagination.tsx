import Link from "next/link";

type Props = {
  /** 페이지 링크 base — 예: "/category/community" 또는 "/category/community/notice". */
  basePath: string;
  currentPage: number;
  totalPages: number;
  /** 표시할 페이지 번호 버튼 개수 (기본 5). */
  windowSize?: number;
};

export default function Pagination({
  basePath,
  currentPage,
  totalPages,
  windowSize = 5,
}: Props) {
  if (totalPages <= 1) return null;

  // 현재 페이지를 중심으로 windowSize 개 버튼을 노출. 끝쪽에선 밀려서 항상 windowSize 유지.
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, currentPage - half);
  const end = Math.min(totalPages, start + windowSize - 1);
  if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  const hrefOf = (p: number) => (p === 1 ? basePath : `${basePath}?page=${p}`);

  const prevDisabled = currentPage <= 1;
  const nextDisabled = currentPage >= totalPages;

  return (
    <nav className="flex items-center justify-center gap-1 pt-2" aria-label="페이지 이동">
      {prevDisabled ? (
        <span
          aria-disabled="true"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300"
        >
          ‹
        </span>
      ) : (
        <Link
          href={hrefOf(currentPage - 1)}
          aria-label="이전 페이지"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white"
        >
          ‹
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={hrefOf(p)}
          aria-current={p === currentPage ? "page" : undefined}
          className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors ${
            p === currentPage
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-white"
          }`}
        >
          {p}
        </Link>
      ))}
      {nextDisabled ? (
        <span
          aria-disabled="true"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-300"
        >
          ›
        </span>
      ) : (
        <Link
          href={hrefOf(currentPage + 1)}
          aria-label="다음 페이지"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white"
        >
          ›
        </Link>
      )}
    </nav>
  );
}
