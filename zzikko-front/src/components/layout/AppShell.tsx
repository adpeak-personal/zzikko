"use client";

import { useState } from "react";
import AppHeader from "./AppHeader";
import MobileSidebar from "./MobileSidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <AppHeader onMobileMenuClick={() => setSidebarOpen(true)} />
      <MobileSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1">
        <div className="max-w-7xl mx-auto w-full px-4 lg:px-6 py-6 lg:py-10">
          {children}
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 text-[11px] text-slate-500 text-center">
          © {new Date().getFullYear()} 찍고. 성지를 찍고, 가격을 찍고.
        </div>
      </footer>
    </div>
  );
}
