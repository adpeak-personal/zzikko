'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { AgreeCheckbox, KakaoButton, OrDivider } from '@/components/auth/KakaoButton';

const REGIONS = ['서울', '경기·인천', '부산', '대구', '대전', '광주', '강원', '제주'];

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-zz-400';
const sideButton =
  'shrink-0 rounded-xl border border-zz-300 px-3 text-sm font-semibold text-zz-700 hover:bg-zz-50 disabled:opacity-50';

/**
 * 이메일 가입 — 휴대폰 인증을 거쳐야 가입 버튼이 동작한다.
 * 카카오 계정은 카카오가 이미 휴대폰을 확인했으므로 카카오 가입에는 인증을 걸지 않는다.
 */
export function SignupForm({ kakao, phoneReady }: { kakao: boolean; phoneReady: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 휴대폰 인증 상태
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [phoneToken, setPhoneToken] = useState<string | null>(null);
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);
  const [phoneBusy, setPhoneBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setPhoneBusy(true);
    setPhoneMsg(null);
    try {
      await apiFetch('/auth/phone/send', { method: 'POST', body: JSON.stringify({ phone }) });
      setSent(true);
      setCooldown(60);
      setPhoneMsg('인증번호를 보냈어요. 3분 안에 입력해 주세요.');
    } catch (err) {
      setPhoneMsg(err instanceof ApiError ? err.message : '인증번호를 보내지 못했어요.');
    } finally {
      setPhoneBusy(false);
    }
  };

  const verifyCode = async () => {
    setPhoneBusy(true);
    setPhoneMsg(null);
    try {
      const res = await apiFetch<{ phoneToken: string }>('/auth/phone/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      });
      setPhoneToken(res.phoneToken);
    } catch (err) {
      setPhoneMsg(err instanceof ApiError ? err.message : '확인하지 못했어요.');
    } finally {
      setPhoneBusy(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!phoneToken) return setError('휴대폰 인증을 먼저 해주세요.');
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;

    setBusy(true);
    setError(null);
    try {
      // 가입하면 바로 로그인 상태가 된다 (서버가 세션 쿠키를 함께 내려준다)
      await apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nickname: form.nickname,
          region: form.region,
          phoneToken,
          agree: form.agree === 'on',
        }),
      });
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '가입하지 못했어요.');
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h1 className="text-xl font-extrabold text-gray-900">회원가입</h1>
      <p className="mt-1 text-sm text-gray-500">이웃들과 시세·후기를 나눠보세요.</p>

      {kakao && (
        <>
          <div className="mt-5">
            <KakaoButton label="카카오로 3초 만에 가입하기" />
          </div>
          <OrDivider />
        </>
      )}

      {!phoneReady ? (
        /* 둘 다 꺼져 있으면 "카카오로 가입해 주세요" 라고 할 수 없다 — 버튼이 없다 */
        <p className="mt-5 rounded-xl bg-gray-50 px-4 py-3 text-sm leading-relaxed text-gray-500">
          {kakao
            ? '이메일 가입(휴대폰 인증)은 준비하고 있어요. 지금은 카카오로 가입해 주세요.'
            : '가입을 잠시 닫아 두었어요. 준비가 끝나면 바로 열립니다. 조금 뒤에 다시 와 주세요.'}
        </p>
      ) : (
        <form onSubmit={onSubmit} className={kakao ? '' : 'mt-5'}>
          <label className="block text-sm font-semibold text-gray-600">
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

          {/* 휴대폰 인증 — 한 번호로 한 계정만. 번호 원본은 저장하지 않는다 */}
          <div className="mt-3">
            <span className="text-sm font-semibold text-gray-600">휴대폰 인증</span>
            {phoneToken ? (
              <p className="mt-1 flex items-center gap-1.5 rounded-xl bg-shop-50 px-4 py-3 text-sm font-semibold text-shop-700">
                <CheckCircle2 size={16} /> {phone} 인증 완료
              </p>
            ) : (
              <>
                <div className="mt-1 flex gap-2">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="010-0000-0000"
                    aria-label="휴대폰 번호"
                    className={`${inputClass} mt-0`}
                  />
                  <button type="button" onClick={sendCode} disabled={phoneBusy || cooldown > 0 || !phone} className={sideButton}>
                    {cooldown > 0 ? `${cooldown}초` : sent ? '다시 받기' : '인증번호 받기'}
                  </button>
                </div>
                {sent && (
                  <div className="mt-2 flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="인증번호 6자리"
                      aria-label="인증번호"
                      className={`${inputClass} mt-0`}
                    />
                    <button type="button" onClick={verifyCode} disabled={phoneBusy || code.length !== 6} className={sideButton}>
                      확인
                    </button>
                  </div>
                )}
                {phoneMsg && <p className="mt-1.5 text-xs text-gray-500">{phoneMsg}</p>}
              </>
            )}
          </div>

          <AgreeCheckbox phone />

          {error && (
            <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || !phoneToken}
            className="mt-5 w-full rounded-xl bg-zz-600 py-3 font-bold text-white hover:bg-zz-700 disabled:opacity-60"
          >
            {busy ? '가입 중…' : '가입하고 시작하기'}
          </button>
        </form>
      )}

      <p className="mt-4 text-center text-sm text-gray-500">
        이미 회원이신가요?{' '}
        <Link href="/login" className="font-semibold text-zz-600 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}
