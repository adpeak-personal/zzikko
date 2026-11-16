'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';
import type { SellerApplication, SellerApplicationStatus } from '@/lib/types';

const STATUSES: SellerApplicationStatus[] = ['신청', '연락중', '승인', '보류'];

const STATUS_STYLE: Record<SellerApplicationStatus, string> = {
  신청: 'bg-zz-50 text-zz-700',
  연락중: 'bg-amber-50 text-amber-700',
  승인: 'bg-emerald-50 text-emerald-700',
  보류: 'bg-gray-100 text-gray-500',
};

/** 숫자만 저장하므로 보여줄 때 다시 끊는다 */
function formatPhone(digits: string) {
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

function Row({ item, onChanged }: { item: SellerApplication; onChanged: (message?: string) => void }) {
  const [memo, setMemo] = useState(item.memo ?? '');
  const [saving, setSaving] = useState(false);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      await apiFetch(`/admin/seller-applications/${item.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onChanged();
    } catch (err) {
      onChanged(err instanceof ApiError ? err.message : '바꾸지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="border-b border-gray-100 px-5 py-4 last:border-0">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <span className="font-bold text-gray-900">{item.shopName}</span>
        <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', STATUS_STYLE[item.status])}>
          {item.status}
        </span>
        <span className="ml-auto text-xs text-gray-400">{formatRelative(item.createdAt)}</span>
      </div>

      <p className="mt-1.5 text-sm text-gray-600">
        {item.manager} ·{' '}
        <a href={`tel:${item.phone}`} className="font-semibold text-gray-900 hover:underline">
          {formatPhone(item.phone)}
        </a>{' '}
        · {item.region}
        {item.area ? ` ${item.area}` : ''}
      </p>

      <p className="mt-1 text-xs text-gray-400">
        {item.carriers.length > 0 ? item.carriers.join(' · ') : '통신사 미선택'}
        {item.channel ? ` · 지금은 ${item.channel}` : ''}
      </p>

      {item.message && (
        <p className="mt-2 whitespace-pre-line rounded-lg bg-gray-50 px-3 py-2 text-sm leading-relaxed text-gray-700">
          {item.message}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            disabled={saving || status === item.status}
            onClick={() => patch({ status })}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-xs transition',
              status === item.status
                ? 'border-transparent bg-gray-900 font-semibold text-white'
                : 'border-gray-200 text-gray-600 hover:border-gray-400 disabled:opacity-50',
            )}
          >
            {status}
          </button>
        ))}

        <button
          type="button"
          onClick={async () => {
            if (!window.confirm(`'${item.shopName}' 신청을 지울까요?`)) return;
            setSaving(true);
            try {
              await apiFetch(`/admin/seller-applications/${item.id}`, { method: 'DELETE' });
              onChanged();
            } catch (err) {
              onChanged(err instanceof ApiError ? err.message : '지우지 못했습니다.');
            } finally {
              setSaving(false);
            }
          }}
          aria-label="삭제"
          className="ml-auto rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
          placeholder="운영진 메모 (신청자에게 안 보입니다)"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-zz-400"
        />
        <button
          type="button"
          disabled={saving || memo === (item.memo ?? '')}
          onClick={() => patch({ memo })}
          className="rounded-lg border border-gray-200 px-3 text-sm text-gray-600 hover:border-gray-400 disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </li>
  );
}

export function SellerApplications({
  items,
  counts,
  active,
}: {
  items: SellerApplication[];
  counts: { status: SellerApplicationStatus; count: number }[];
  active?: SellerApplicationStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const onChanged = (message?: string) => {
    setError(message ?? null);
    if (!message) router.refresh();
  };

  const countOf = (status: SellerApplicationStatus) => counts.find((row) => row.status === status)?.count ?? 0;
  const total = counts.reduce((sum, row) => sum + row.count, 0);

  const href = (status?: SellerApplicationStatus) =>
    status ? `/admin/sellers?status=${encodeURIComponent(status)}` : '/admin/sellers';

  return (
    <div className="space-y-4">
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        <a
          href={href()}
          className={cn(
            'shrink-0 rounded-lg border px-3 py-1.5 text-sm',
            !active ? 'border-transparent bg-gray-900 font-semibold text-white' : 'border-gray-200 bg-white text-gray-600',
          )}
        >
          전체 {total}
        </a>
        {STATUSES.map((status) => (
          <a
            key={status}
            href={href(status)}
            className={cn(
              'shrink-0 rounded-lg border px-3 py-1.5 text-sm',
              active === status
                ? 'border-transparent bg-gray-900 font-semibold text-white'
                : 'border-gray-200 bg-white text-gray-600',
            )}
          >
            {status} {countOf(status)}
          </a>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {items.length > 0 ? (
          <ul>
            {items.map((item) => (
              <Row key={item.id} item={item} onChanged={onChanged} />
            ))}
          </ul>
        ) : (
          <p className="py-16 text-center text-sm text-gray-400">아직 신청이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
