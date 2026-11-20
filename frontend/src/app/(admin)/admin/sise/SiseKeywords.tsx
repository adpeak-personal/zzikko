'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search, Trash2 } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { SiseKeyword } from '@/lib/types';

const PER_PAGE = 15;

export interface KeywordPick {
  id: number;
  keyword: string;
  place: string;
}

/**
 * 어느 지역 시세 글을 쓸지 고르는 표.
 *
 * 검색량이 받쳐주는 지역만 쓰기 위한 화면이다 — "경기 휴대폰성지"는 거의 안 찾고
 * "부천 휴대폰성지"는 월 3천이 넘는다. 고르면 아래 올리기 폼의 지역과 제목이 바뀐다.
 *
 * **작성일은 손으로 체크하지 않는다** — 글이 실제로 저장될 때 서버가 적는다.
 * 체크해 놓고 글을 안 쓰거나, 글만 쓰고 체크를 잊는 일이 둘 다 생기기 때문이다.
 */
export function SiseKeywords({
  keywords,
  ready,
  picked,
  onPick,
}: {
  keywords: SiseKeyword[];
  /** 네이버 검색광고 API 키가 있는지 */
  ready: boolean;
  picked: KeywordPick | null;
  onPick: (pick: KeywordPick | null) => void;
}) {
  const [items, setItems] = useState(keywords);
  // 글을 저장하면 서버가 작성일을 적고 router.refresh() 가 새 목록을 내려준다.
  // useState 는 처음 값만 쓰므로, 바뀐 props 를 여기서 받아줘야 화면에 반영된다.
  const [lastProp, setLastProp] = useState(keywords);
  if (lastProp !== keywords) {
    setLastProp(keywords);
    setItems(keywords);
  }

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');

  const fail = (err: unknown, fallback: string) =>
    setError(err instanceof ApiError ? err.message : fallback);

  const shown = useMemo(() => {
    const word = search.trim();
    return word ? items.filter((item) => item.keyword.includes(word)) : items;
  }, [items, search]);

  const pageCount = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = shown.slice(safePage * PER_PAGE, safePage * PER_PAGE + PER_PAGE);

  const fetchVolumes = async () => {
    setBusy('fetch');
    setError(null);
    try {
      const res = await apiFetch<{ saved: number; keywords: SiseKeyword[] }>('/admin/sise/keywords/fetch', {
        method: 'POST',
      });
      setItems(res.keywords);
      setPage(0);
    } catch (err) {
      fail(err, '검색량을 가져오지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const clearAll = async () => {
    if (!confirm(`지역 키워드 ${items.length}개를 모두 지웁니다. 작성일 기록도 같이 사라집니다.\n계속할까요?`)) return;
    setBusy('clear');
    setError(null);
    try {
      await apiFetch('/admin/sise/keywords/clear', { method: 'POST' });
      setItems([]);
      setPage(0);
      onPick(null);
    } catch (err) {
      fail(err, '비우지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const writtenCount = items.filter((item) => item.done).length;

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-1.5 font-bold text-gray-900">
            <Search size={16} className="text-gray-400" />
            지역 키워드
            {items.length > 0 && (
              <span className="text-sm font-normal text-gray-400">
                {items.length}개{writtenCount > 0 && ` · 작성 ${writtenCount}`}
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            월 <b>200회 이상</b> 찾는 지역만 가져옵니다. 고르면 아래 <b>지역·제목</b>이 바뀝니다.
          </p>
        </div>

        <div className="flex gap-2">
          {items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              disabled={busy !== null}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              <Trash2 size={14} />
              {busy === 'clear' ? '비우는 중…' : '초기화'}
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
      </header>

      {!ready && (
        <p className="border-b border-gray-100 bg-amber-50 px-5 py-2 text-xs text-amber-800">
          <b>네이버 검색광고 API 키가 없습니다.</b> <code>.env.local</code> 에 <code>NAVER_AD_API_KEY</code> ·{' '}
          <code>NAVER_AD_SECRET_KEY</code> · <code>NAVER_AD_CUSTOMER_ID</code> 를 넣어주세요.
        </p>
      )}
      {error && <p className="border-b border-gray-100 bg-red-50 px-5 py-2 text-xs text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          아직 받아온 키워드가 없습니다. <b>검색량 가져오기</b> 를 눌러보세요.
        </p>
      ) : (
        <>
          <div className="border-b border-gray-100 px-5 py-2.5">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder="키워드 거르기 (수원, 성지 …)"
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-zz-400 sm:w-64"
            />
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                <th className="w-10 px-5 py-2 font-medium" />
                <th className="px-2 py-2 font-medium">키워드</th>
                <th className="w-28 px-2 py-2 text-right font-medium">월간검색수</th>
                <th className="w-16 px-2 py-2 text-center font-medium">경쟁</th>
                <th className="w-24 px-5 py-2 text-right font-medium">작성일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const active = picked?.id === item.id;
                return (
                  <tr
                    key={item.id}
                    onClick={() => onPick(active ? null : { id: item.id, keyword: item.keyword, place: item.place })}
                    className={cn(
                      'cursor-pointer border-b border-gray-50 last:border-0',
                      active ? 'bg-zz-50' : 'hover:bg-gray-50',
                    )}
                  >
                    <td className="px-5 py-2">
                      <input
                        type="radio"
                        checked={active}
                        readOnly
                        aria-label={`${item.keyword} 고르기`}
                        className="accent-zz-600"
                      />
                    </td>
                    <td className={cn('px-2 py-2', item.done ? 'text-gray-400' : 'text-gray-900')}>
                      <span className="font-medium">{item.keyword}</span>
                      {item.place && <span className="ml-1.5 text-xs text-gray-400">{item.place}</span>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-700">
                      {item.monthly.toLocaleString()}
                    </td>
                    <td className="px-2 py-2 text-center text-xs text-gray-400">{item.competition || '-'}</td>
                    <td className="px-5 py-2 text-right text-xs">
                      {item.doneAt ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700">
                          {formatDate(item.doneAt)}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-sm text-gray-400">
                    찾는 키워드가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between px-5 py-3 text-xs text-gray-500">
            <span>
              {shown.length}개 중 {safePage * PER_PAGE + 1}–{Math.min(shown.length, (safePage + 1) * PER_PAGE)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                disabled={safePage === 0}
                aria-label="이전 쪽"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="tabular-nums">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                disabled={safePage >= pageCount - 1}
                aria-label="다음 쪽"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
