import { redirect } from 'next/navigation';
import Link from 'next/link';
import { apiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/data';
import type { BlogProfile } from '@/lib/types';
import { BlogProfileAdmin } from '@/components/admin/BlogProfileAdmin';
import { BlogDraftAdmin } from '@/components/admin/BlogDraftAdmin';
import type { ComponentProps } from 'react';

export const metadata = { title: '블로그 작업 프로필' };

export default async function AdminBlogPage({ searchParams }: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/blog');
  if (me.role !== '운영진') redirect('/');

  const { items } = await apiGet<{ items: BlogProfile[] }>('/admin/blog/profiles');
  const showDrafts = (await searchParams).tab === 'drafts';
  const tabs = (
    <nav aria-label="블로그 관리" className="flex gap-4 text-sm font-semibold text-zz-600">
      <Link href="/admin/blog" aria-current={!showDrafts ? 'page' : undefined}>프로필</Link>
      <Link href="/admin/blog?tab=drafts" aria-current={showDrafts ? 'page' : undefined}>원고</Link>
    </nav>
  );
  if (showDrafts) {
    type DraftProps = ComponentProps<typeof BlogDraftAdmin>;
    const [sources, queue] = await Promise.all([
      apiGet<{ items: DraftProps['sources'] }>('/admin/blog/draft-sources'),
      apiGet<{ items: DraftProps['queue'] }>('/admin/blog/drafts'),
    ]);
    return <div className="space-y-5">{tabs}<BlogDraftAdmin profiles={items} sources={sources.items} queue={queue.items} /></div>;
  }

  return (
    <div className="space-y-5">
      {tabs}
      <div>
        <h1 className="text-xl font-bold text-gray-900">블로그 작업 프로필</h1>
        <p className="mt-1 text-sm text-gray-500">
          <b>프로필 하나에 아이디 하나</b>입니다. IP 는 여러 프로필이 나눠 써도 됩니다 — 목록은 IP 로 묶어
          보여줍니다. 아이디를 붙이려면{' '}
          <a href="/admin/nwork" className="font-semibold text-zz-600 hover:underline">
            네이버 계정
          </a>{' '}
          화면에서 프로필 이름을 적어 여기에 붙입니다.
        </p>
      </div>
      <BlogProfileAdmin items={items} />
    </div>
  );
}
