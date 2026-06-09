type Props = {
  filters?: string[];
  searchPlaceholder?: string;
};

export default function CategoryToolbar({
  filters = ["전체", "오늘", "이번주", "인기순", "최신순"],
  searchPlaceholder = "게시글 검색",
}: Props) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 pb-1 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((f, i) => (
          <button
            key={f}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              i === 0
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="relative md:shrink-0">
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm w-full md:w-56 focus:outline-none focus:border-blue-400"
        />
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
    </div>
  );
}
