"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import Logo from "@/components/common/Logo";
import { CATEGORIES } from "@/config/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MobileSidebar({ open, onClose }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <div
      className={`lg:hidden fixed inset-0 z-40 transition-opacity ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* 패널 */}
      <aside
        className={`absolute left-0 top-0 bottom-0 w-72 max-w-[80vw] bg-[#0f1115] border-r border-white/10 shadow-2xl flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-14 px-5 flex items-center justify-between border-b border-white/5">
          <Logo width={110} />
          <button
            onClick={onClose}
            className="p-1.5 -mr-1 text-slate-400 hover:text-white"
            aria-label="메뉴 닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <p className="px-5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            카테고리
          </p>
          <ul className="px-2">
            {CATEGORIES.filter((c) => !c.hiddenFromNav).map((c) => {
              const active = pathname?.startsWith(`/category/${c.slug}`);
              return (
                <li key={c.slug}>
                  <Link
                    href={`/category/${c.slug}`}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition-colors ${
                      active
                        ? "bg-blue-500/15 text-blue-300"
                        : "text-slate-200 hover:bg-white/5"
                    }`}
                  >
                    <span className="text-lg">{c.icon}</span>
                    <span className="flex-1">{c.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="p-4 border-t border-white/5">
          <Link
            href="/auth/login"
            onClick={onClose}
            className="block w-full text-center bg-white/10 hover:bg-white/20 text-white text-sm font-bold py-3 rounded-xl transition-colors"
          >
            로그인 / 회원가입
          </Link>
        </div>
      </aside>
    </div>
  );
}
