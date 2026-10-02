import Link from 'next/link';
import { BrandLogo } from '@/components/layout/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8">
        <BrandLogo size={36} />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-8 text-xs text-gray-400">© 2026 ZZIKKO</p>
    </div>
  );
}
