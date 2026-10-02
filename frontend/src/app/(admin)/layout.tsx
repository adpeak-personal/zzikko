import Link from 'next/link';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import { AdminNav } from '@/components/admin/AdminNav';

export const metadata = { title: { default: '어드민', template: '%s | 어드민' } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 bg-zz-950 text-white">
        <div className="flex h-14 items-center gap-4 px-4">
          <Link href="/admin" className="flex shrink-0 items-center gap-2 font-extrabold lg:w-52">
            <span className="rounded bg-zz-500 px-1.5 py-0.5 text-xs">ADMIN</span>
            찍고
          </Link>

          {/* 인증이 아직 없어서 이 화면은 누구나 접근할 수 있다. 감추지 말고 드러내 둔다. */}
          <p className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-amber-300">
            <ShieldAlert size={13} className="shrink-0" />
            <span className="truncate">인증 미구현 — 배포 전 운영진 권한 검사 필요</span>
          </p>

          <Link href="/" className="flex shrink-0 items-center gap-1 text-xs text-gray-300 hover:text-white">
            <ExternalLink size={13} /> 사이트 보기
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <AdminNav />
        <main className="min-w-0 flex-1 bg-gray-50 px-4 py-6 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
