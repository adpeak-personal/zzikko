import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageCircle, PenSquare } from 'lucide-react';
import { getBoards, getCurrentUser, getPosts } from '@/lib/data';
import { PostTable } from '@/components/board/PostTable';
import { LogoutButton } from './LogoutButton';
import { Avatar, Card, LevelBadge, PageTitle, SellerBadge } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: '마이페이지' };

export default async function MyPage() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/mypage');

  const [myPosts, boards] = await Promise.all([getPosts({ authorId: me.id, size: 20 }), getBoards()]);
  const boardNames = Object.fromEntries(boards.map((board) => [board.slug, board.name]));
  const commentCount = myPosts.items.reduce((sum, post) => sum + post.commentCount, 0);

  return (
    <div>
      <PageTitle title="마이페이지" />

      <Card className="px-6 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar user={me} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold tracking-tight text-gray-900">{me.nickname}</h2>
              {me.role === '판매자' ? <SellerBadge /> : <LevelBadge level={me.level} />}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {me.email} · {me.region} · {formatDate(me.joinedAt)} 가입
            </p>
            {me.bio && <p className="mt-2 text-gray-600">{me.bio}</p>}
          </div>
          <LogoutButton />
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-gray-100">
          <div className="bg-white px-4 py-4 text-center">
            <dt className="flex items-center justify-center gap-1 text-xs text-gray-500">
              <PenSquare size={13} />
              작성한 글
            </dt>
            <dd className="mt-1 text-xl font-extrabold text-gray-900">{myPosts.total}</dd>
          </div>
          <div className="bg-white px-4 py-4 text-center">
            <dt className="flex items-center justify-center gap-1 text-xs text-gray-500">
              <MessageCircle size={13} />내 글에 달린 댓글
            </dt>
            <dd className="mt-1 text-xl font-extrabold text-gray-900">{commentCount}</dd>
          </div>
        </dl>
      </Card>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">내가 쓴 글</h2>
          <Link href="/write" className="text-sm font-semibold text-zz-600 hover:underline">
            글쓰기
          </Link>
        </div>
        <PostTable items={myPosts.items} showBoard boardNames={boardNames} />
      </section>
    </div>
  );
}
