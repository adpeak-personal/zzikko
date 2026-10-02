import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/data';
import type { Chipset, PhoneSpec } from '@/lib/types';
import { ChipsetAdmin, SpecAdmin } from '@/components/admin/ContentAdmin';

export const metadata = { title: '기종 사양 관리' };

export default async function AdminSpecsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/specs');
  if (me.role !== '운영진') redirect('/');

  const { items, chipsets } = await apiGet<{ items: PhoneSpec[]; chipsets: Chipset[] }>('/admin/specs');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">기종 사양 관리</h1>
        <p className="mt-1 text-sm text-gray-500">스펙 비교 게시판의 기종 목록과 사양을 관리합니다.</p>
      </div>

      <SpecAdmin specs={items} chipsets={chipsets} />

      <ChipsetAdmin chipsets={chipsets} specs={items} />
    </div>
  );
}
