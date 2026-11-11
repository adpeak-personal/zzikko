import Link from 'next/link';
import { ChevronRight, LogIn, PenSquare } from 'lucide-react';
import { getBoardGroups, getCurrentUser, getPosts, getShops } from '@/lib/data';
import { Avatar, LevelBadge } from '@/components/ui';
import { SidebarBoards } from './SidebarNav';
import { formatNumber } from '@/lib/utils';

export async function Sidebar() {
  const [me, boardGroups, shops, all] = await Promise.all([
    getCurrentUser(),
    getBoardGroups(),
    getShops(),
    getPosts({ size: 1 }),
  ]);

  const myPosts = me ? await getPosts({ authorId: me.id, size: 1 }) : null;

  return (
    <aside className="hidden w-64 shrink-0 space-y-3 lg:block">
      {/* 내 프로필 */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        {me ? (
          <>
            <Link href="/mypage" className="group flex items-center gap-3">
              <Avatar user={me} size={46} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-gray-900 group-hover:text-zz-700">{me.nickname}</p>
                <p className="mt-0.5 truncate text-xs text-gray-400">
                  {me.region}
                  {me.bio ? ` · ${me.bio}` : ''}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-gray-300" />
            </Link>

            <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5">
              <LevelBadge level={me.level} />
              <dl className="flex gap-3 text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <dt>내 글</dt>
                  <dd className="font-bold text-gray-900">{myPosts?.total ?? 0}</dd>
                </div>
              </dl>
            </div>
          </>
        ) : (
          <Link href="/login" className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-3 hover:bg-gray-100">
            <LogIn size={18} className="text-gray-400" />
            <span className="text-sm">
              <span className="block font-bold text-gray-900">로그인하고 참여하기</span>
              <span className="block text-xs text-gray-400">글쓰기·댓글·좋아요</span>
            </span>
          </Link>
        )}

        <Link
          href="/write"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-zz-600 py-3 font-bold text-white hover:bg-zz-700"
        >
          <PenSquare size={16} /> 글쓰기
        </Link>
      </section>

      <SidebarBoards boardGroups={boardGroups} />

      {/* 커뮤니티 현황 */}
      <section className="rounded-2xl border border-gray-200 bg-white px-4 py-3.5">
        <dl className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">전체 글</dt>
            <dd className="font-bold text-gray-900">{formatNumber(all.total)}개</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-500">등록 매장</dt>
            <dd className="font-bold text-gray-900">{shops.length}곳</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}
