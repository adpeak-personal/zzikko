"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/common/Logo";
import { ADMIN_NAV } from "@/config/admin-nav";

type Props = {
  /** 모바일 드로어에서 항목 클릭 시 닫기 */
  onNavigate?: () => void;
};

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

export default function AdminSidebar({ onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[#0f1115] text-slate-200">
      <div className="flex h-16 items-center gap-2 px-5 border-b border-white/5">
        <Logo width={110} />
        <span className="text-[11px] font-bold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded-md">
          ADMIN
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="px-2 space-y-1">
          {ADMIN_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    active
                      ? "bg-blue-500/15 text-blue-300"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-white/5">
        <Link
          href="/"
          onClick={onNavigate}
          className="block w-full text-center bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
        >
          ← 사이트로 돌아가기
        </Link>
      </div>
    </div>
  );
}
