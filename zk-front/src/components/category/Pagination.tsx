type Props = {
  currentPage?: number;
  totalPages?: number;
};

export default function Pagination({ currentPage = 1, totalPages = 5 }: Props) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button className="w-9 h-9 rounded-lg text-slate-400 hover:bg-white">‹</button>
      {pages.map((p) => (
        <button
          key={p}
          className={`w-9 h-9 rounded-lg text-sm font-bold transition-colors ${
            p === currentPage
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-white"
          }`}
        >
          {p}
        </button>
      ))}
      <button className="w-9 h-9 rounded-lg text-slate-400 hover:bg-white">›</button>
    </div>
  );
}
