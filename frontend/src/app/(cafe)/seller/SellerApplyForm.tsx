'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';

const REGIONS = ['서울', '경기·인천', '부산', '대구', '대전', '광주', '강원', '제주'];
const CARRIERS = ['SKT', 'KT', 'LG U+', '알뜰폰'];
const CHANNELS = ['카카오톡', '네이버 밴드', '오픈채팅', '뽐뿌·카페', '블로그', '없음'];

const inputClass =
  'mt-1 w-full rounded-xl border border-gray-200 px-4 py-3 text-[15px] outline-none focus:border-zz-400';

function Done() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zz-50 text-zz-600">
        <Check size={28} />
      </span>
      <h2 className="mt-4 text-xl font-extrabold text-gray-900">신청이 접수됐습니다</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
        영업일 기준 <b>1~2일 안에</b> 남겨주신 번호로 연락드리겠습니다.
        <br />
        시세표는 저희가 대신 올려드리니 조건만 보내주시면 됩니다.
      </p>
    </div>
  );
}

export function SellerApplyForm() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (done) return <Done />;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    const body = {
      shopName: String(data.get('shopName') ?? ''),
      manager: String(data.get('manager') ?? ''),
      phone: String(data.get('phone') ?? ''),
      region: String(data.get('region') ?? ''),
      area: String(data.get('area') ?? ''),
      // 체크박스는 getAll 로 묶어야 여러 개가 다 들어온다
      carriers: data.getAll('carriers').map(String),
      channel: String(data.get('channel') ?? ''),
      message: String(data.get('message') ?? ''),
    };

    setBusy(true);
    setError(null);
    try {
      await apiFetch('/seller-applications', { method: 'POST', body: JSON.stringify(body) });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '신청하지 못했어요. 잠시 후 다시 시도해주세요.');
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="text-xl font-extrabold text-gray-900">입점 신청</h2>
      <p className="mt-1 text-sm text-gray-500">연락처만 남겨주시면 저희가 연락드립니다. 가입 안 하셔도 됩니다.</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-gray-600">
          매장 이름
          <input name="shopName" required maxLength={60} placeholder="강남 모바일" className={inputClass} />
        </label>
        <label className="block text-sm font-semibold text-gray-600">
          담당자
          <input name="manager" required maxLength={30} placeholder="홍길동" className={inputClass} />
        </label>
      </div>

      <label className="mt-3 block text-sm font-semibold text-gray-600">
        연락처
        <input
          name="phone"
          type="tel"
          required
          inputMode="numeric"
          maxLength={20}
          placeholder="010-0000-0000"
          className={inputClass}
        />
      </label>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-gray-600">
          지역
          <select name="region" defaultValue="서울" className={inputClass}>
            {REGIONS.map((region) => (
              <option key={region}>{region}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-gray-600">
          시·군·구
          <input name="area" maxLength={60} placeholder="강남구" className={inputClass} />
        </label>
      </div>

      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-gray-600">취급 통신사</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {CARRIERS.map((carrier) => (
            <label
              key={carrier}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 px-3.5 py-2 text-sm text-gray-700 has-checked:border-zz-500 has-checked:bg-zz-50 has-checked:font-semibold has-checked:text-zz-700"
            >
              <input type="checkbox" name="carriers" value={carrier} className="accent-zz-600" />
              {carrier}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-sm font-semibold text-gray-600">
        지금 조건은 어디에 올리세요?
        <select name="channel" defaultValue="카카오톡" className={inputClass}>
          {CHANNELS.map((channel) => (
            <option key={channel}>{channel}</option>
          ))}
        </select>
      </label>

      <label className="mt-3 block text-sm font-semibold text-gray-600">
        하고 싶은 말
        <textarea
          name="message"
          rows={4}
          maxLength={1000}
          placeholder="궁금한 점이나 요청사항을 자유롭게 적어주세요."
          className={`${inputClass} resize-y leading-relaxed`}
        />
      </label>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 w-full rounded-xl bg-zz-600 py-3.5 text-[15px] font-bold text-white hover:bg-zz-700 disabled:opacity-60"
      >
        {busy ? '보내는 중…' : '무료로 입점 신청하기'}
      </button>

      <p className="mt-3 text-center text-xs leading-relaxed text-gray-400">
        남겨주신 정보는 입점 상담 목적으로만 쓰고, 상담이 끝나면 지웁니다.
      </p>
    </form>
  );
}
