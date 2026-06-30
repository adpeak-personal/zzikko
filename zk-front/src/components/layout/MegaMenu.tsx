"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CATEGORIES } from "@/config/navigation";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function MegaMenu({ open, onClose }: Props) {
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`hidden lg:block fixed inset-x-0 top-16 bottom-0 z-30 transition-opacity ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      {/* 백드롭 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 메가메뉴 패널 */}
      <div
        className={`relative bg-white shadow-2xl border-b border-slate-200 transition-all duration-200 ${
          open ? "translate-y-0" : "-translate-y-4"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-8">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-4">
            전체 카테고리
          </p>

          <div className="grid grid-cols-4 gap-3">
            {CATEGORIES.filter((c) => !c.hiddenFromNav).map((c) => {
              const active = pathname?.startsWith(`/category/${c.slug}`);
              return (
                <Link
                  key={c.slug}
                  href={`/category/${c.slug}`}
                  onClick={onClose}
                  className={`group flex items-start gap-3 p-4 rounded-xl border transition-all ${
                    active
                      ? "border-blue-300 bg-blue-50"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div
                    className={`w-11 h-11 ${c.color} rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    {c.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3
                      className={`font-bold text-sm leading-tight ${
                        active ? "text-blue-700" : "text-slate-800"
                      }`}
                    >
                      {c.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2 leading-tight">
                      {c.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* 빠른 링크 */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
            <Link
              href="/auth/login"
              onClick={onClose}
              className="font-bold text-slate-700 hover:text-blue-600"
            >
              로그인 / 회원가입
            </Link>
            <Link
              href="/notice"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800"
            >
              공지사항
            </Link>
            <Link
              href="/help"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-800"
            >
              고객센터
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
