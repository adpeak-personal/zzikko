"use client";

import Link from "next/link";
import { ADMIN_NAV } from "@/config/admin-nav";

export default function AdminDashboardPage() {
  const shortcuts = ADMIN_NAV.filter((item) => item.href !== "/admin");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">관리자 페이지에 오신 것을 환영합니다.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {shortcuts.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all"
          >
            <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
              {item.icon}
            </div>
            <h3 className="font-bold text-slate-800">{item.title}</h3>
          </Link>
        ))}
      </div>
    </div>
  );
}
