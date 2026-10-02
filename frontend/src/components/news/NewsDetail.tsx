import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { NewsArticle } from '@/lib/types';
import { Tag, Thumb } from '@/components/ui';
import { formatDate } from '@/lib/utils';

/** 기사 상세 — 게시글이 아니라 어드민에서 관리하는 콘텐츠다 */
export function NewsDetail({ article, others }: { article: NewsArticle; others: NewsArticle[] }) {
  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-sm font-medium text-gray-400" aria-label="현재 위치">
        <Link href="/board/news" className="hover:text-gray-700">
          IT 소식
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-600">{article.category}</span>
      </nav>

      <article className="mx-auto max-w-3xl">
        <Tag tone="zz">{article.category}</Tag>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-gray-900">{article.title}</h1>
        <p className="mt-3 text-lg text-gray-600">{article.summary}</p>
        <p className="mt-4 border-b border-gray-200 pb-5 text-sm text-gray-400">
          {article.author} · {formatDate(article.date)}
          {!article.published && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">미발행</span>}
        </p>

        <Thumb tone={article.thumb} className="mt-6 h-64 rounded-2xl" />

        <div className="mt-8 whitespace-pre-line text-[17px] leading-[1.9] text-gray-800">{article.body}</div>

        <div className="mt-10 border-t border-gray-100 pt-6">
          <Link href="/board/news" className="flex w-fit items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-2.5 font-bold text-gray-700 hover:border-gray-300">
            <ArrowLeft size={16} /> 목록
          </Link>
        </div>
      </article>

      {others.length > 0 && (
        <section className="mx-auto max-w-3xl pt-4">
          <h2 className="mb-3 text-base font-bold text-gray-900">다른 소식</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {others.map((item) => (
              <li key={item.id}>
                <Link href={`/board/news/${item.id}`} className="group flex gap-3">
                  <Thumb tone={item.thumb} className="h-16 w-24 shrink-0 rounded-lg" />
                  <span className="min-w-0">
                    <span className="line-clamp-2 block text-sm font-semibold text-gray-900 group-hover:underline">
                      {item.title}
                    </span>
                    <span className="mt-1 block text-xs text-gray-400">{formatDate(item.date)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
