import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/data';
import type { NewsArticle } from '@/lib/types';
import { NewsAdmin } from '@/components/admin/ContentAdmin';

export const metadata = { title: 'IT 소식 관리' };

export default async function AdminNewsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/news');
  if (me.role !== '운영진') redirect('/');

  const { items } = await apiGet<{ items: NewsArticle[] }>('/admin/news');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">IT 소식 관리</h1>
        <p className="mt-1 text-sm text-gray-500">사이트의 IT 소식 게시판에 나갈 기사를 등록·수정합니다.</p>
      </div>

      <NewsAdmin articles={items} />
    </div>
  );
}
