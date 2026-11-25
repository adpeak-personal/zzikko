import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { query } from '@/lib/api';
import { getCurrentUser } from '@/lib/data';
import type { BlogProfile, NworkAccount, NworkSummary, Paged } from '@/lib/types';
import { NworkAdmin, type NworkFilters } from '@/components/admin/NworkAdmin';

export const metadata = { title: '네이버 작업 계정' };

type Params = {
  searchParams: Promise<{ q?: string; exclude?: string; role?: string; noRole?: string; usable?: string; working?: string; page?: string }>;
};

const PAGE_SIZE = 50;

export default async function AdminNworkPage({ searchParams }: Params) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/nwork');
  if (me.role !== '운영진') redirect('/');

  const sp = await searchParams;
  const filters: NworkFilters = {
    q: sp.q?.trim() ?? '',
    exclude: sp.exclude === '1' ? '1' : '',
    role: sp.role ?? '',
    noRole: sp.noRole === '1' ? '1' : '',
    usable: sp.usable === '1' || sp.usable === '0' ? sp.usable : '',
    working: sp.working === '1' || sp.working === '0' ? sp.working : '',
  };
  const page = Math.max(1, Number(sp.page) || 1);

  // 프로필 목록도 같이 받는다 — 계정 수정 화면에서 **골라** 넣게 하려고.
  // 손으로 적으면 오타가 나고, 이미 다른 아이디가 쓰는 프로필을 적으면 저장이 막힌다.
  const [data, profiles] = await Promise.all([
    apiGet<Paged<NworkAccount> & { summary: NworkSummary }>(
      '/admin/nwork' + query({ ...filters, page, size: PAGE_SIZE }),
    ),
    apiGet<{ items: BlogProfile[] }>('/admin/blog/profiles'),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">네이버 작업 계정</h1>
        <p className="mt-1 text-sm text-gray-500">
          블로그 · 밴드 등 자동화 프로그램이 쓰는 계정입니다. 용도와 상태를 바꾸면 프로그램이 다음 작업부터 따릅니다.
        </p>
      </div>

      <NworkAdmin data={data} filters={filters} profiles={profiles.items} />
    </div>
  );
}
