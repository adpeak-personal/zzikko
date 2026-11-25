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
