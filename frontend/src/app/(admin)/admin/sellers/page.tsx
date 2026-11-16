import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/data';
import type { SellerApplication, SellerApplicationStatus } from '@/lib/types';
import { SellerApplications } from './SellerApplications';

export const metadata = { title: '판매자 신청' };

const STATUSES: SellerApplicationStatus[] = ['신청', '연락중', '승인', '보류'];

interface Response {
  items: SellerApplication[];
  counts: { status: SellerApplicationStatus; count: number }[];
}

export default async function AdminSellersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/sellers');
  if (me.role !== '운영진') redirect('/');

  const { status } = await searchParams;
  const active = STATUSES.find((item) => item === status);

  const data = await apiGet<Response>(`/admin/seller-applications${active ? `?status=${encodeURIComponent(active)}` : ''}`);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">판매자 신청</h1>
        <p className="mt-1 text-sm text-gray-500">
          <a href="/seller" className="text-zz-600 hover:underline">
            /seller
          </a>{' '}
          페이지로 들어온 입점 신청입니다. 연락하면서 상태를 바꿔주세요.
        </p>
      </div>

      <SellerApplications items={data.items} counts={data.counts} active={active} />
    </div>
  );
}
