'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-zz-400';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;

    setBusy(true);
    setError(null);
    try {
      await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(form) });
      // 서버 컴포넌트가 로그인 상태를 다시 읽도록 새로고침한다
      router.replace(next && next.startsWith('/') ? next : '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '로그인하지 못했어요.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-gray-200 bg-white p-6">
      <h1 className="text-xl font-extrabold text-gray-900">로그인</h1>
      <p className="mt-1 text-sm text-gray-500">글쓰기·댓글·좋아요를 쓰려면 로그인해 주세요.</p>

      <label className="mt-5 block text-sm font-semibold text-gray-600">
        이메일
        <input name="email" type="email" required autoComplete="email" placeholder="me@zzikko.test" className={inputClass} />
      </label>

      <label className="mt-3 block text-sm font-semibold text-gray-600">
        비밀번호
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </label>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-xl bg-zz-600 py-3 font-bold text-white hover:bg-zz-700 disabled:opacity-60"
      >
        {busy ? '로그인 중…' : '로그인'}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        아직 회원이 아니신가요?{' '}
        <Link href="/signup" className="font-semibold text-zz-600 hover:underline">
          회원가입
        </Link>
      </p>

      <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-500">
        데모 계정 — <b>me@zzikko.test</b> (회원) · <b>gangnam@zzikko.test</b> (판매자) · <b>admin@zzikko.test</b> (운영진)
        <br />
        비밀번호는 모두 <b>zzikko1234</b>
      </p>
    </form>
  );
}
