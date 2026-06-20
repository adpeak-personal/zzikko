"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/common/Logo";
import MegaMenu from "./MegaMenu";
import { useAuthStore } from "@/store/auth";
import { apiFetch, clearTokens } from "@/lib/auth";

type Props = {
  onMobileMenuClick: () => void;
};

export default function AppHeader({ onMobileMenuClick }: Props) {
  const [pcMenuOpen, setPcMenuOpen] = useState(false);
  const router = useRouter();
  const { user, isLoading, setUser } = useAuthStore();

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearTokens();
    setUser(null);
    router.push("/");
  }

  useEffect(() => {
    if (!pcMenuOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [pcMenuOpen]);

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0f1115]/95 backdrop-blur border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-14 lg:h-16 flex items-center justify-between gap-4">
          {/* 좌측: 모바일 햄버거 + 로고 */}
          <div className="flex items-center gap-2">
            <button
              onClick={onMobileMenuClick}
              className="lg:hidden p-2 -ml-2 text-slate-200 hover:text-white"
              aria-label="메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Logo width={120} className="lg:hidden" />
            <Logo width={140} className="hidden lg:inline-flex" />
          </div>

          {/* 우측: 검색 + 로그인 + (PC) 메뉴 버튼 */}
          <div className="flex items-center gap-1 lg:gap-2">
            <button
              className="p-2 text-slate-300 hover:text-white"
              aria-label="검색"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {isLoading ? (
              <div className="w-16 h-8 rounded-lg bg-white/10 animate-pulse" />
            ) : user ? (
              <button
                onClick={handleLogout}
                className="text-xs lg:text-sm font-bold text-white bg-white/10 hover:bg-white/20 px-3 lg:px-4 py-2 rounded-lg transition-all"
              >
                로그아웃
              </button>
            ) : (
              <Link
                href="/auth/login"
                className="text-xs lg:text-sm font-bold text-white bg-white/10 hover:bg-white/20 px-3 lg:px-4 py-2 rounded-lg transition-all"
              >
                로그인
              </Link>
            )}

            {/* PC 전용 메가메뉴 트리거 */}
            <button
              onClick={() => setPcMenuOpen((v) => !v)}
              className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                pcMenuOpen
                  ? "bg-white text-slate-900"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              aria-expanded={pcMenuOpen}
              aria-label="전체 메뉴"
            >
              {pcMenuOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
              <span>메뉴</span>
            </button>
          </div>
        </div>
      </header>

      <MegaMenu open={pcMenuOpen} onClose={() => setPcMenuOpen(false)} />
    </>
  );
}
