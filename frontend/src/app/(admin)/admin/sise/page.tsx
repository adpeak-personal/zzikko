import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/data';
import type { Region, SiseReport } from '@/lib/types';
import { SiseAdmin } from './SiseAdmin';

export const metadata = { title: '시세 리포트' };

interface Response {
  items: SiseReport[];
  regions: Region[];
  aiReady: boolean;
}

export default async function AdminSisePage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/sise');
  if (me.role !== '운영진') redirect('/');

  const data = await apiGet<Response>('/admin/sise');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">시세 리포트</h1>
        <p className="mt-1 text-sm leading-relaxed text-gray-500">
          시세표 이미지를 올리면 표를 읽어 글을 만듭니다. 발행하면{' '}
          <a href="/sise" target="_blank" rel="noreferrer" className="text-zz-600 hover:underline">
            /sise
          </a>{' '}
          와 사이트맵에 올라갑니다 — <b>사이드바·헤더 메뉴에는 나오지 않습니다.</b> 검색으로 들어오는 글입니다.
        </p>
      </div>

      <SiseAdmin items={data.items} regions={data.regions} aiReady={data.aiReady} />
    </div>
  );
}
