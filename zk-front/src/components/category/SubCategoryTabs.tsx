import Link from "next/link";
import type { SubCategoryNav } from "@/config/navigation";

type Props = {
  /** 부모 카테고리 slug (e.g. "free") */
  parentSlug: string;
  /** navigation.ts 에 정의된 서브 카테고리들 */
  subs: SubCategoryNav[];
  /** 현재 선택된 서브 slug. undefined 면 "전체" */
  current?: string;
};

export default function SubCategoryTabs({ parentSlug, subs, current }: Props) {
  const items = [{ slug: undefined as string | undefined, title: "전체", icon: "🗂️" }, ...subs];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((s) => {
        const active = s.slug === current;
        const href = s.slug ? `/category/${parentSlug}/${s.slug}` : `/category/${parentSlug}`;
        return (
          <Link
            key={s.slug ?? "all"}
            href={href}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold border transition-colors ${
              active
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s.icon && <span>{s.icon}</span>}
            <span>{s.title}</span>
          </Link>
        );
      })}
    </div>
  );
}
