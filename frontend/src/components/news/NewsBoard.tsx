'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { NewsArticle } from '@/lib/types';
import { EmptyState, FilterChip, Thumb } from '@/components/ui';
import { formatDate } from '@/lib/utils';

/** 매거진형 목록 — 맨 위 대표 기사 하나, 아래로 카드 격자 */
export function NewsBoard({ articles }: { articles: NewsArticle[] }) {
  const [category, setCategory] = useState<string | null>(null);

  const categories = [...new Set(articles.map((a) => a.category))];
  const shown = category ? articles.filter((a) => a.category === category) : articles;
  // 대표 기사는 필터가 없을 때만 크게 띄운다
  const lead = !category ? (shown.find((a) => a.featured) ?? shown[0]) : undefined;
  const rest = lead ? shown.filter((a) => a.id !== lead.id) : shown;

  return (
    <div>
      <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto">
        <FilterChip href="#" active={!category} onClick={() => setCategory(null)}>
          전체
        </FilterChip>
        {categories.map((item) => (
          <FilterChip key={item} href="#" active={category === item} onClick={() => setCategory(item)}>
            {item}
          </FilterChip>
        ))}
      </div>

      {lead && (
        <Link
          href={`/board/news/${lead.id}`}
          className="group mb-6 block overflow-hidden rounded-2xl border border-gray-200 bg-white sm:flex"
        >
          <Thumb tone={lead.thumb} className="h-48 shrink-0 sm:h-auto sm:w-2/5" label={lead.category} />
          <div className="flex flex-col justify-center p-6">
            <span className="text-xs font-bold text-zz-600">{lead.category}</span>
            <h2 className="mt-2 text-2xl font-extrabold leading-snug tracking-tight text-gray-900 group-hover:underline">
              {lead.title}
            </h2>
            <p className="mt-2.5 line-clamp-2 text-gray-600">{lead.summary}</p>
            <p className="mt-4 text-xs text-gray-400">
              {lead.author} · {formatDate(lead.date)}
            </p>
            <span className="mt-4 flex items-center gap-1 text-sm font-bold text-zz-600">
              기사 읽기 <ArrowRight size={15} />
            </span>
          </div>
        </Link>
      )}

      {rest.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rest.map((article) => (
            <li key={article.id}>
              <Link href={`/board/news/${article.id}`} className="group flex h-full flex-col">
                <Thumb tone={article.thumb} className="aspect-16/9 rounded-xl" />
                <span className="mt-3 text-xs font-bold text-zz-600">{article.category}</span>
                <h3 className="mt-1 line-clamp-2 text-[17px] font-bold leading-snug text-gray-900 group-hover:underline">
                  {article.title}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-sm text-gray-500">{article.summary}</p>
                <p className="mt-auto pt-3 text-xs text-gray-400">
                  {article.author} · {formatDate(article.date)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        !lead && (
          <div className="rounded-xl border border-gray-200 bg-white">
            <EmptyState>등록된 기사가 없습니다.</EmptyState>
          </div>
        )
      )}
    </div>
  );
}
