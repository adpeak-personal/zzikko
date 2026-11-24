'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api';
import type { PlanList } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

interface SyncResult {
  added: number;
  updated: number;
  ended: number;
  total: number;
}

/** 받아 오기 버튼 + 지금 상태. 요금제를 손으로 고치는 화면은 없다 — 원문이 정본이다 */
export function PlanAdmin({ data, board }: { data: PlanList; board: { slug: string; name: string } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const counts = data.items.reduce<Record<string, number>>((acc, plan) => {
    acc[plan.network] = (acc[plan.network] ?? 0) + 1;
    return acc;
  }, {});

  async function sync() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await apiFetch<SyncResult>('/admin/plans/sync', { method: 'POST' });
      setMessage({
        ok: true,
        text: `${formatNumber(result.total)}개를 받았습니다 — 새로 ${result.added}개, 갱신 ${result.updated}개, 판매 종료 ${result.ended}개.`,
      });
      router.refresh();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof ApiError ? error.message : '받아 오지 못했습니다.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {!board && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-700">
          형식이 <b>유심 요금제</b>인 게시판이 없어 화면에 보이지 않습니다.{' '}
          <Link href="/admin/boards" className="font-bold underline">
            게시판 관리
          </Link>
          에서 게시판의 목록 형식을 &lsquo;유심 요금제&rsquo;로 바꿔 주세요.
        </p>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">판매 중인 요금제</p>
            <p className="mt-1 text-2xl font-extrabold text-gray-900">{formatNumber(data.items.length)}개</p>
            <p className="mt-1 text-xs text-gray-500">
              {Object.entries(counts)
                .map(([network, count]) => `${network} ${count}`)
                .join(' · ') || '아직 받아 온 적이 없습니다.'}
            </p>
            {data.syncedAt && <p className="mt-1 text-xs text-gray-400">마지막으로 받은 시각 {data.syncedAt}</p>}
          </div>
          <button
            type="button"
            onClick={sync}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-zz-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-60"
          >
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
            {busy ? '받아 오는 중… (20초쯤)' : '지금 받아 오기'}
          </button>
        </div>

        {message && (
          <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-shop-50 text-shop-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </p>
        )}

        <ul className="mt-4 space-y-1 border-t border-gray-100 pt-4 text-xs leading-relaxed text-gray-500">
          <li>· 받을 때마다 덮어씁니다. 목록에서 빠진 요금제는 지우지 않고 &lsquo;판매 종료&rsquo;로 내립니다.</li>
          <li>· 하나도 읽지 못하면 저장하지 않습니다(페이지 형식이 바뀐 경우).</li>
          <li>· 자동으로 돌지 않습니다. 요금이 바뀌는 시기(월초 등)에 한 번씩 눌러 주세요.</li>
          {board && (
            <li>
              · 보이는 곳:{' '}
              <Link href={`/board/${board.slug}`} className="text-zz-600 underline">
                {board.name}
              </Link>
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
