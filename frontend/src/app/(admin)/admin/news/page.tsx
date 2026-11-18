import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/data';
import type { NewsArticle, NewsFeedItem, NewsFeedStatus } from '@/lib/types';
import { NewsAdmin } from '@/components/admin/ContentAdmin';
import { NewsFeed } from './NewsFeed';

export const metadata = { title: 'IT 소식 관리' };

const STATUSES: NewsFeedStatus[] = ['수집', '작성됨', '숨김'];

interface FeedResponse {
  items: NewsFeedItem[];
  counts: { status: NewsFeedStatus; count: number }[];
  sources: string[];
  aiReady: boolean;
}

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/news');
  if (me.role !== '운영진') redirect('/');

  const { feed } = await searchParams;
  const active = STATUSES.find((item) => item === feed);

  const [articles, feedData] = await Promise.all([
    apiGet<{ items: NewsArticle[] }>('/admin/news'),
    apiGet<FeedResponse>(`/admin/news/feed${active ? `?status=${encodeURIComponent(active)}` : ''}`),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">IT 소식 관리</h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          바깥 소식을 받아 한국어 기사로 만들고, 검토한 뒤 발행합니다. 퍼온 기사에는{' '}
          <b>출처와 링크가 자동으로 붙습니다</b> — 출처 표기가 이용 조건이라 지우지 마세요.
        </p>
      </div>

      <NewsFeed
        items={feedData.items}
        counts={feedData.counts}
        active={active}
        sources={feedData.sources}
        aiReady={feedData.aiReady}
      />

      <section>
        <h2 className="mb-3 font-bold text-gray-900">기사 목록</h2>
        <NewsAdmin articles={articles.items} />
      </section>
    </div>
  );
}
