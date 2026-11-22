import { redirect } from 'next/navigation';
import { apiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/data';
import type { BoardGroup, Post } from '@/lib/types';
import { BoardSettings } from './BoardSettings';

export const metadata = { title: '게시판 관리' };

export default async function AdminBoardsPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin/boards');
  if (me.role !== '운영진') redirect('/');

  // 공개용 /boards 는 게시판이 없는 대분류를 빼므로, 어드민은 전부 주는 쪽을 쓴다
  const [{ items: groups }, stats] = await Promise.all([
    apiGet<{ items: BoardGroup[] }>('/admin/board-groups'),
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
          대분류 이름(연필 아이콘)과 게시판 이름 · 설명 · 목록 형식 · 글 작성 방식 · 말머리를 바꿉니다.
          글은 그대로 유지됩니다. 대분류는 맨 위 &apos;대분류 추가&apos;로, 게시판은 각 대분류 맨 아래 &apos;게시판 추가&apos;로 만듭니다.
        </p>
      </div>

      <BoardSettings groups={withCounts} />
    </div>
  );
}
