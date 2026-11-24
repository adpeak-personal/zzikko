import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { getBoardGroups, getCurrentUser } from '@/lib/data';
import type { PlanList } from '@/lib/types';
import { PlanAdmin } from '@/components/admin/PlanAdmin';

export const metadata = { title: '유심 요금제 관리' };

export default async function AdminPlansPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/plans');
  if (me.role !== '운영진') redirect('/');

  const [data, groups] = await Promise.all([apiGet<PlanList>('/plans'), getBoardGroups()]);
  // 형식이 '유심 요금제' 인 게시판 — slug 는 어드민에서 바뀔 수 있으니 형식으로 찾는다
  const board = groups.flatMap((group) => group.boards).find((item) => item.type === 'plan') ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">유심 요금제 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          {data.source.name} 목록에서 요금제를 받아 와 유심 요금제 게시판에 보여줍니다.
        </p>
      </div>
      <PlanAdmin data={data} board={board ? { slug: board.slug, name: board.name } : null} />
    </div>
  );
}
