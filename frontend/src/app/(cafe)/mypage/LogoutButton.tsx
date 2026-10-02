'use client';

import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await apiFetch('/auth/logout', { method: 'POST' });
        router.replace('/');
        router.refresh();
      }}
      className="rounded-xl border border-gray-200 px-4 py-2.5 font-bold text-gray-700 hover:border-gray-300"
    >
      로그아웃
    </button>
  );
}
