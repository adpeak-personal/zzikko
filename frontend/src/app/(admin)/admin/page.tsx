import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FileText, MessageCircle, Store, Users } from 'lucide-react';
import { apiGet } from '@/lib/api.server';
import { getCurrentUser } from '@/lib/data';
import type { Post, PublicUser } from '@/lib/types';
import { Avatar } from '@/components/ui';
import { formatNumber, formatRelative } from '@/lib/utils';

export const metadata = { title: '대시보드' };

interface AdminStats {
  totals: { users: number; posts: number; shops: number };
  recent7d: { users: number };
  byBoard: { slug: string; name: string; type: string; postCount: number }[];
  recentPosts: Post[];
  recentUsers: PublicUser[];
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        <Icon size={14} className="text-zz-500" />
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default async function AdminDashboard() {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/admin');
  if (me.role !== '운영진') redirect('/');

  const stats = await apiGet<AdminStats>('/admin/stats');
  const maxPostCount = Math.max(1, ...stats.byBoard.map((board) => board.postCount));
  const commentCount = stats.recentPosts.reduce((sum, post) => sum + post.commentCount, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">대시보드</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label="회원" value={formatNumber(stats.totals.users)} sub={`최근 7일 +${stats.recent7d.users}`} />
        <StatCard icon={FileText} label="게시글" value={formatNumber(stats.totals.posts)} />
        <StatCard icon={MessageCircle} label="최근 글의 댓글" value={formatNumber(commentCount)} />
        <StatCard icon={Store} label="등록 매장" value={formatNumber(stats.totals.shops)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-gray-200 bg-white">
          <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h2 className="text-sm font-bold text-gray-900">게시판별 글 수</h2>
            <Link href="/admin/boards" className="text-xs text-zz-600 hover:underline">
              게시판 관리 →
            </Link>
          </header>
          <ul className="divide-y divide-gray-50">
            {stats.byBoard.map((board) => (
              <li key={board.slug} className="flex items-center gap-3 px-5 py-2">
                <Link href={`/board/${board.slug}`} className="w-28 shrink-0 truncate text-sm text-gray-800 hover:underline">
                  {board.name}
                </Link>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-zz-400" style={{ width: `${(board.postCount / maxPostCount) * 100}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-500">{board.postCount}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-bold text-gray-900">최근 가입</h2>
          <ul className="divide-y divide-gray-50">
            {stats.recentUsers.map((user) => (
              <li key={user.id} className="flex items-center gap-2.5 px-5 py-2.5">
                <Avatar user={user} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-800">{user.nickname}</span>
                <span className="shrink-0 text-xs text-gray-400">{user.joinedAt.slice(2).replace(/-/g, '.')}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-bold text-gray-900">최근 게시글</h2>
        <ul className="divide-y divide-gray-50">
          {stats.recentPosts.map((post) => (
            <li key={post.id}>
              <Link href={`/board/${post.boardSlug}/${post.id}`} className="flex items-center gap-2 px-5 py-2.5 text-sm hover:bg-gray-50">
                <span className="line-clamp-1 text-gray-800">{post.title}</span>
                {post.commentCount > 0 && <span className="shrink-0 text-xs font-bold text-zz-500">[{post.commentCount}]</span>}
                <span className="ml-auto shrink-0 text-xs text-gray-400">{post.author?.nickname}</span>
                <span className="w-16 shrink-0 text-right text-xs text-gray-400">{formatRelative(post.createdAt)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
