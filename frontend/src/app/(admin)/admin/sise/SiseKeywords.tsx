'use client';

import { useState } from 'react';
import { Check, RefreshCw, RotateCcw, Search } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { SiseKeyword } from '@/lib/types';

/**
 * 어느 지역 시세 글을 쓸지 고르는 목록.
 *
 * 검색량이 받쳐주는 지역만 쓰기 위한 화면이다 — "경기 휴대폰성지"는 거의 안 찾고
 * "부천 휴대폰성지"는 월 3천이 넘는다. 지역을 누르면 아래 올리기 폼의 지역이 바뀐다.
 *
 * 글을 쓴 지역은 ✓ 로 덮어 둔다. 검색량을 다시 받아도 이 표시는 풀리지 않는다.
 */
export function SiseKeywords({
  keywords,
  ready,
  selected,
  onPick,
}: {
  keywords: SiseKeyword[];
  /** 네이버 검색광고 API 키가 있는지 */
  ready: boolean;
  selected: string;
  onPick: (place: string) => void;
}) {
  const [items, setItems] = useState(keywords);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);

  const fail = (err: unknown, fallback: string) =>
    setError(err instanceof ApiError ? err.message : fallback);

  const fetchVolumes = async () => {
    setBusy('fetch');
    setError(null);
    try {
      const res = await apiFetch<{ saved: number; keywords: SiseKeyword[] }>('/admin/sise/keywords/fetch', {
        method: 'POST',
      });
      setItems(res.keywords);
    } catch (err) {
      fail(err, '검색량을 가져오지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (item: SiseKeyword) => {
    const next = !item.done;
    // 먼저 화면을 바꾸고 보낸다 — 체크는 되돌리기 쉬운 동작이라 기다릴 이유가 없다
    setItems((list) => list.map((row) => (row.id === item.id ? { ...row, done: next } : row)));
    try {
      await apiFetch(`/admin/sise/keywords/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ done: next }),
      });
    } catch (err) {
      setItems((list) => list.map((row) => (row.id === item.id ? { ...row, done: item.done } : row)));
      fail(err, '표시를 바꾸지 못했어요.');
    }
  };

  const clearDone = async () => {
    setBusy('clear');
    try {
      await apiFetch('/admin/sise/keywords/clear', { method: 'POST' });
      setItems((list) => list.map((row) => ({ ...row, done: false })));
    } catch (err) {
      fail(err, '표시를 풀지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const doneCount = items.filter((item) => item.done).length;
  const shown = showDone ? items : items.filter((item) => !item.done);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 font-bold text-gray-900">
            <Search size={16} className="text-gray-400" />
            지역 키워드
            {items.length > 0 && <span className="text-sm font-normal text-gray-400">{items.length}개</span>}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            검색량이 받쳐주는 지역만 씁니다. 지역을 누르면 아래 <b>올리기 폼의 지역</b>이 바뀝니다.
          </p>
        </div>

        <div className="flex gap-2">
          {doneCount > 0 && (
            <button
              type="button"
              onClick={clearDone}
              disabled={busy !== null}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw size={14} />
              {busy === 'clear' ? '푸는 중…' : `✓ ${doneCount}개 풀기`}
            </button>
          )}
          <button
            type="button"
            onClick={fetchVolumes}
            disabled={!ready || busy !== null}
            className="flex items-center gap-1 rounded-lg bg-zz-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn(busy === 'fetch' && 'animate-spin')} />
            {busy === 'fetch' ? '가져오는 중…' : '검색량 가져오기'}
          </button>
        </div>
      </div>

      {!ready && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <b>네이버 검색광고 API 키가 없습니다.</b> <code>.env.local</code> 에 <code>NAVER_AD_API_KEY</code> ·{' '}
          <code>NAVER_AD_SECRET_KEY</code> · <code>NAVER_AD_CUSTOMER_ID</code> 를 넣어주세요.
        </p>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="mt-4 py-6 text-center text-sm text-gray-400">
          아직 받아온 키워드가 없습니다. <b>검색량 가져오기</b> 를 눌러보세요.
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {shown.map((item) => {
              const active = item.place !== '' && item.place === selected;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => (item.place ? onPick(item.place) : undefined)}
                  onDoubleClick={() => toggle(item)}
                  title={`${item.keyword} · 월 ${item.monthly.toLocaleString()}회 · 경쟁 ${item.competition || '-'}\n두 번 누르면 "썼음" 표시`}
                  className={cn(
                    'group flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition',
                    item.done
                      ? 'border-gray-200 bg-gray-50 text-gray-400 line-through'
                      : active
                        ? 'border-zz-600 bg-zz-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-zz-300',
                  )}
                >
                  <span className="font-semibold">{item.keyword}</span>
                  <span className={cn('tabular-nums', active ? 'text-white/70' : 'text-gray-400')}>
                    {item.monthly.toLocaleString()}
                  </span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={item.done ? '썼음 표시 풀기' : '썼음으로 표시'}
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggle(item);
                    }}
                    className={cn(
                      'rounded-full p-0.5',
                      item.done ? 'text-zz-600' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500',
                    )}
                  >
                    <Check size={11} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
            <button type="button" onClick={() => setShowDone((v) => !v)} className="hover:text-gray-600">
              {showDone ? '쓴 지역 숨기기' : `쓴 지역 보기 (${doneCount})`}
            </button>
            <span>· 숫자는 월간검색수 · ✓ 를 누르면 썼음 표시</span>
          </div>
        </>
      )}
    </section>
  );
}
