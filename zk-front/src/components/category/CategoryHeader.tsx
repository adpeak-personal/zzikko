import Link from "next/link";
import { CATEGORIES } from "@/config/navigation";

type Props = {
  slug: string;
  cta?: React.ReactNode;
};

export default function CategoryHeader({ slug, cta }: Props) {
  const category = CATEGORIES.find((c) => c.slug === slug);
  if (!category) return null;

  return (
    <div className="space-y-4">
      <nav className="text-xs text-slate-500 flex items-center gap-1.5">
        <Link href="/" className="hover:text-blue-600">홈</Link>
        <span>/</span>
        <span className="text-slate-700 font-medium">{category.title}</span>
      </nav>

      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div
            className={`w-12 h-12 ${category.color} rounded-2xl flex items-center justify-center text-2xl shrink-0`}
          >
            {category.icon}
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-slate-900 tracking-tight">
              {category.title}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">{category.desc}</p>
          </div>
        </div>
        {cta}
      </header>
    </div>
  );
}

export function WriteButton({ label = "글쓰기", href }: { label?: string; href?: string }) {
  const inner = (
    <>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
      {label}
    </>
  );
  if (href) {
    return (
      <Link href={href} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5">
        {inner}
      </Link>
    );
  }
  return (
    <button className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-1.5">
      {inner}
    </button>
  );
}
