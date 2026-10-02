'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';

const REGIONS = ['서울', '경기·인천', '부산', '대구', '대전', '광주', '강원', '제주'];

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-zz-400';

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;

    setBusy(true);
    setError(null);
    try {
      // 가입하면 바로 로그인 상태가 된다 (서버가 세션 쿠키를 함께 내려준다)
      await apiFetch('/auth/signup', { method: 'POST', body: JSON.stringify(form) });
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '가입하지 못했어요.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-gray-200 bg-white p-6">
      <h1 className="text-xl font-extrabold text-gray-900">회원가입</h1>
      <p className="mt-1 text-sm text-gray-500">이웃들과 시세·후기를 나눠보세요.</p>

      <label className="mt-5 block text-sm font-semibold text-gray-600">
        이메일
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>

      <label className="mt-3 block text-sm font-semibold text-gray-600">
        비밀번호
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
        <span className="mt-1 block text-xs font-normal text-gray-400">8자 이상</span>
      </label>

      <label className="mt-3 block text-sm font-semibold text-gray-600">
        닉네임
        <input name="nickname" required minLength={2} maxLength={30} className={inputClass} />
      </label>

      <label className="mt-3 block text-sm font-semibold text-gray-600">
        지역
        <select name="region" defaultValue="서울" className={inputClass}>
          {REGIONS.map((region) => (
            <option key={region}>{region}</option>
          ))}
        </select>
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
        {busy ? '가입 중…' : '가입하고 시작하기'}
      </button>

      <p className="mt-4 text-center text-sm text-gray-500">
        이미 회원이신가요?{' '}
        <Link href="/login" className="font-semibold text-zz-600 hover:underline">
          로그인
        </Link>
      </p>
    </form>
  );
}
