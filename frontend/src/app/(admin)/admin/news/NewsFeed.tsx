'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, EyeOff, RefreshCw, Sparkles } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { cn, formatRelative } from '@/lib/utils';
import type { NewsFeedItem, NewsFeedStatus } from '@/lib/types';

const STATUSES: NewsFeedStatus[] = ['수집', '작성됨', '숨김'];

const STATUS_STYLE: Record<NewsFeedStatus, string> = {
  수집: 'bg-zz-50 text-zz-700',
  작성됨: 'bg-emerald-50 text-emerald-700',
  숨김: 'bg-gray-100 text-gray-500',
};

/**
 * 뉴스 수집함.
 *
 * 수집은 자동, **고르는 건 사람이** 한다. 기사는 미발행 초안으로 들어가므로
 * 아래 "기사 목록" 에서 읽어보고 발행하면 된다.
 */
export function NewsFeed({
  items,
  counts,
  active,
  sources,
  aiReady,
}: {
  items: NewsFeedItem[];
  counts: { status: NewsFeedStatus; count: number }[];
  active?: NewsFeedStatus;
  sources: string[];
  aiReady: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | 'fetch' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const fail = (err: unknown, fallback: string) =>
    setError(err instanceof ApiError ? err.message : fallback);

  const countOf = (status: NewsFeedStatus) => counts.find((row) => row.status === status)?.count ?? 0;

  const collect = async () => {
    setError(null);
    setNote(null);
    setBusy('fetch');
    try {
      const result = await apiFetch<{ added: number; failed: string[] }>('/admin/news/feed/fetch', {
        method: 'POST',
      });
      setNote(
        result.added > 0 ? `새 소식 ${result.added}건을 받았습니다.` : '새로 올라온 소식이 없습니다.',
      );
      if (result.failed.length) setError(`${result.failed.join(', ')} 에서 받지 못했습니다.`);
      router.refresh();
    } catch (err) {
      fail(err, '소식을 받지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const write = async (item: NewsFeedItem) => {
    setError(null);
    setNote(null);
    setBusy(item.id);
    try {
      const result = await apiFetch<{ article: { title: string }; relevance: number }>(
        `/admin/news/feed/${item.id}/write`,
        { method: 'POST' },
      );
      setNote(`"${result.article.title}" 초안을 만들었습니다. 아래 기사 목록에서 검토 후 발행하세요.`);
      router.refresh();
    } catch (err) {
      fail(err, '기사를 쓰지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const hide = async (item: NewsFeedItem) => {
    setError(null);
    try {
      await apiFetch(`/admin/news/feed/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: item.status === '숨김' ? '수집' : '숨김' }),
      });
      router.refresh();
    } catch (err) {
      fail(err, '바꾸지 못했어요.');
    }
  };

  const href = (status?: NewsFeedStatus) =>
    status ? `/admin/news?feed=${encodeURIComponent(status)}` : '/admin/news';

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">
          <h2 className="font-bold text-gray-900">뉴스 수집함</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            {sources.join(' · ')} 에서 받아옵니다. <b>고르는 건 직접</b> 하시고, 만든 기사는 초안으로 들어갑니다.
          </p>
        </div>
        <button
          type="button"
          onClick={collect}
          disabled={busy !== null}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:border-gray-400 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(busy === 'fetch' && 'animate-spin')} />
          {busy === 'fetch' ? '받는 중…' : '새 소식 받기'}
        </button>
      </header>

      {!aiReady && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>ANTHROPIC_API_KEY 가 없습니다.</b> 수집은 되지만 기사 작성이 동작하지 않습니다.
        </p>
      )}
      {note && <p className="rounded-xl bg-zz-50 px-4 py-3 text-sm text-zz-800">{note}</p>}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        <a
          href={href()}
          className={cn(
            'shrink-0 rounded-lg border px-3 py-1.5 text-sm',
            !active ? 'border-transparent bg-gray-900 font-semibold text-white' : 'border-gray-200 bg-white text-gray-600',
          )}
        >
          전체 {counts.reduce((sum, row) => sum + row.count, 0)}
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

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        {items.length === 0 ? (
          <p className="py-14 text-center text-sm text-gray-400">
            받아온 소식이 없습니다. <b>새 소식 받기</b> 를 눌러보세요.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', STATUS_STYLE[item.status])}>
                    {item.status}
                  </span>
                  <span className="text-xs text-gray-400">{item.sourceName}</span>
                  <span className="ml-auto text-xs text-gray-400">{formatRelative(item.publishedAt)}</span>
                </div>

                <p className="mt-1.5 font-semibold leading-snug text-gray-900">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500">{item.preview}</p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy !== null || !aiReady || item.status === '작성됨'}
                    onClick={() => write(item)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-zz-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zz-700 disabled:opacity-40"
                  >
                    <Sparkles size={13} />
                    {busy === item.id ? '쓰는 중…' : item.status === '작성됨' ? '작성됨' : '기사로 만들기'}
                  </button>

                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer nofollow"
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-gray-400"
                  >
                    <ExternalLink size={12} />
                    원문
                  </a>

                  <button
                    type="button"
                    onClick={() => hide(item)}
                    className="ml-auto inline-flex items-center gap-1 rounded-lg p-1.5 text-xs text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                  >
                    <EyeOff size={13} />
                    {item.status === '숨김' ? '되돌리기' : '숨기기'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
