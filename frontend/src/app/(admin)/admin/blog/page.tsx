import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/data';
import type { BlogProfile } from '@/lib/types';
import { BlogProfileAdmin } from '@/components/admin/BlogProfileAdmin';

export const metadata = { title: '블로그 작업 프로필' };

export default async function AdminBlogPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/blog');
  if (me.role !== '운영진') redirect('/');

  const { items } = await apiGet<{ items: BlogProfile[] }>('/admin/blog/profiles');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">블로그 작업 프로필</h1>
        <p className="mt-1 text-sm text-gray-500">
          <b>IP 하나에 크롬 프로필 하나</b>가 한 쌍입니다. 네이버 계정은{' '}
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
