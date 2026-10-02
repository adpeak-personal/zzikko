import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { getBoardGroups, getCurrentUser } from '@/lib/data';
import type { Post } from '@/lib/types';
import { BoardSettings } from './BoardSettings';

export const metadata = { title: '게시판 관리' };

export default async function AdminBoardsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/boards');
  if (me.role !== '운영진') redirect('/');

  const [groups, stats] = await Promise.all([
    getBoardGroups(),
    apiGet<{ byBoard: { slug: string; postCount: number }[]; recentPosts: Post[] }>('/admin/stats'),
  ]);

  const countBySlug = Object.fromEntries(stats.byBoard.map((board) => [board.slug, board.postCount]));
  const withCounts = groups.map((group) => ({
    ...group,
    boards: group.boards.map((board) => ({ ...board, postCount: countBySlug[board.slug] ?? 0 })),
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">게시판 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          게시판 이름 · 설명 · 목록 형식 · 글 작성 방식 · 말머리를 바꿉니다. 글은 그대로 유지됩니다.
        </p>
      </div>

      <BoardSettings groups={withCounts} />
    </div>
  );
}
