"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import { useAuthStore } from "@/store/auth";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoading } = useAuthStore();

  // 라우트 이동 시 모바일 드로어 닫기
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // 드로어 열렸을 때 배경 스크롤 잠금
  useEffect(() => {
    if (!mobileOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [mobileOpen]);

  // 권한 가드
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUB_ADMIN";
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-6 text-center">
        <p className="text-5xl">🔒</p>
        <h1 className="text-xl font-extrabold text-slate-900">접근 권한이 없습니다</h1>
        <p className="text-sm text-slate-500">
          관리자 계정으로 로그인해야 이용할 수 있습니다.
        </p>
        <Link
          href="/"
          className="mt-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl transition-colors"
        >
          홈으로
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* 데스크탑 사이드바 (고정) */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-64 z-30">
        <AdminSidebar />
      </aside>

      {/* 모바일 드로어 */}
      <div
        className={`lg:hidden fixed inset-0 z-40 transition-opacity ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
        <div
          className={`absolute left-0 top-0 bottom-0 w-64 max-w-[80vw] shadow-2xl transition-transform ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <AdminSidebar onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* 본문 영역 */}
      <div className="lg:pl-64">
        {/* 상단바 (모바일 햄버거) */}
        <header className="sticky top-0 z-20 h-14 bg-white/90 backdrop-blur border-b border-slate-200 flex items-center gap-3 px-4 lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden p-1.5 -ml-1.5 text-slate-600 hover:text-slate-900"
            aria-label="메뉴 열기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1" />
          <span className="text-sm font-bold text-slate-700">{user?.nickname}</span>
          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
            {user?.role}
          </span>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
