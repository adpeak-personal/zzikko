"use client";

import Link from "next/link";
import type { BoardSub } from "@/service/board-subs/types";
import { useAuthStore } from "@/store/auth";

type Props = {
  /** 부모 카테고리 slug (e.g. "community", "reviews") */
  parentSlug: string;
  /** DB 에서 fetch 된 서브카테고리들 (sort_order 정렬) */
  subs: BoardSub[];
  /** 현재 선택된 서브 slug. undefined 면 "전체" */
  current?: string;
};

export default function SubCategoryTabs({ parentSlug, subs, current }: Props) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUB_ADMIN";

  // hidden_from_nav 서브는 어드민만 볼 수 있음. 단, 현재 URL 로 접근 중이면 활성 표시를 위해 그대로 남김.
  const visibleSubs = subs.filter(
    (s) => !s.hidden_from_nav || isAdmin || s.slug === current,
  );
  const items = [
    { slug: undefined as string | undefined, title: "전체", icon: "🗂️" },
    ...visibleSubs,
  ];

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
