'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { AgreeCheckbox } from '@/components/auth/KakaoButton';

const REGIONS = ['서울', '경기·인천', '부산', '대구', '대전', '광주', '강원', '제주'];

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-zz-400';

/**
 * 카카오로 처음 들어온 사람의 마무리 — 닉네임 확인과 약관 동의만 받는다.
 * 카카오 정보는 서버가 짧은 서명 쿠키에 들고 있어서, 이 화면은 그걸 모른 채 닉네임만 보낸다.
 */
export function KakaoSignupForm() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ready' | 'expired'>('loading');
  const [nickname, setNickname] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ nickname: string | null; nicknameTaken: boolean }>('/auth/kakao/pending')
      .then((res) => {
        setNickname(res.nickname ?? '');
        if (res.nicknameTaken) setHint('카카오 닉네임을 이미 다른 분이 쓰고 있어요. 다른 닉네임을 정해 주세요.');
        setState('ready');
      })
      .catch(() => setState('expired'));
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;

    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ next?: string }>('/auth/kakao/complete', {
        method: 'POST',
        body: JSON.stringify({ nickname, region: form.region, agree: form.agree === 'on' }),
      });
      router.replace(res.next && res.next.startsWith('/') ? res.next : '/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '가입하지 못했어요.');
      setBusy(false);
    }
  };

  if (state === 'loading') {
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-400">불러오는 중…</div>;
  }

  if (state === 'expired') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
        카카오 로그인 시간이 지났어요.{' '}
        <Link href="/login" className="font-semibold text-zz-600 hover:underline">
          다시 로그인
        </Link>
        해 주세요.
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-gray-200 bg-white p-6">
      <h1 className="text-xl font-extrabold text-gray-900">거의 다 됐어요</h1>
      <p className="mt-1 text-sm text-gray-500">찍고에서 쓸 닉네임만 정해 주세요.</p>

      <label className="mt-5 block text-sm font-semibold text-gray-600">
        닉네임
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          required
          minLength={2}
          maxLength={30}
          autoFocus
          className={inputClass}
        />
        {hint && <span className="mt-1 block text-xs font-normal text-amber-700">{hint}</span>}
      </label>

      <label className="mt-3 block text-sm font-semibold text-gray-600">
        지역
        <select name="region" defaultValue="서울" className={inputClass}>
          {REGIONS.map((region) => (
            <option key={region}>{region}</option>
          ))}
        </select>
      </label>

      <AgreeCheckbox />

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
    </form>
  );
}
