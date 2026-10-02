import Link from 'next/link';
import { Heart, Image as ImageIcon } from 'lucide-react';
import type { Post } from '@/lib/types';
import { Avatar, EmptyState, LevelBadge, Tag, Thumb } from '@/components/ui';
import { formatNumber, formatRelative, thumbTone } from '@/lib/utils';

/**
 * 일반 게시판 목록 — 데스크톱은 표, 모바일은 리스트.
 * 첫 칸은 말머리(전체글보기에서는 게시판 이름)다. 댓글 수는 제목에 바로 붙이고,
 * 이미지가 있으면 제목 칸 오른쪽 끝에 아이콘만 둔다.
 */
export function PostTable({
  items,
  notices = [],
  showBoard = false,
  boardNames = {},
}: {
  items: Post[];
  notices?: Post[];
  showBoard?: boolean;
  /** 전체글보기에서 slug → 게시판 이름 */
  boardNames?: Record<string, string>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* 데스크톱 테이블 */}
      <table className="hidden w-full text-sm md:table">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="w-28 py-3 font-medium">{showBoard ? '게시판' : '말머리'}</th>
            <th className="py-3 text-left font-medium">제목</th>
            <th className="w-36 py-3 text-left font-medium">작성자</th>
            <th className="w-20 py-3 font-medium">작성일</th>
            <th className="w-16 py-3 font-medium">조회</th>
            <th className="w-16 py-3 font-medium">좋아요</th>
          </tr>
        </thead>
        <tbody>
          {notices.map((post) => (
            <Row key={`notice-${post.id}`} post={post} notice showBoard={showBoard} boardNames={boardNames} />
          ))}
          {items.map((post) => (
            <Row key={post.id} post={post} showBoard={showBoard} boardNames={boardNames} />
          ))}
        </tbody>
      </table>

      {/* 모바일 리스트 */}
      <ul className="divide-y divide-gray-100 md:hidden">
        {[...notices, ...items].map((post) => {
          const tone = thumbTone(post);
          return (
            <li key={`m-${post.id}`} className={post.isNotice ? 'bg-zz-50/50' : ''}>
              <Link href={`/board/${post.boardSlug}/${post.id}`} className="flex items-start gap-3 px-4 py-4">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[14px] leading-snug text-gray-900">
                    {post.isNotice && <Tag tone="zz">공지</Tag>}{' '}
                    {post.category && !post.isNotice && <span className="text-zz-600">[{post.category}]</span>} {post.title}
                    {post.commentCount > 0 && <span className="ml-1 text-[11px] font-bold text-zz-500">[{post.commentCount}]</span>}
                  </span>
                  <span className="mt-1.5 block text-[10px] text-gray-400">
                    {post.author?.nickname} · {formatRelative(post.createdAt)} · 조회 {formatNumber(post.views)}
                  </span>
                </span>
                {tone && <Thumb tone={tone} className="h-14 w-14 shrink-0 rounded-lg" />}
              </Link>
            </li>
          );
        })}
      </ul>

      {items.length === 0 && notices.length === 0 && <EmptyState>등록된 게시글이 없습니다.</EmptyState>}
    </div>
  );
}

function Row({
  post,
  notice,
  showBoard,
  boardNames,
}: {
  post: Post;
  notice?: boolean;
  showBoard?: boolean;
  boardNames: Record<string, string>;
}) {
  const author = post.author;
  // 전체글보기에서는 말머리 대신 어느 게시판 글인지가 더 중요하다
  const label = showBoard ? boardNames[post.boardSlug] : post.category;

  return (
    <tr className={`border-b border-gray-100 last:border-0 hover:bg-gray-50 ${notice ? 'bg-zz-50/40' : ''}`}>
      <td className="px-2 py-4 text-center">
        {notice ? (
          <Tag tone="zz">공지</Tag>
        ) : label ? (
          <span className="text-xs font-medium text-zz-600">{label}</span>
        ) : (
          // 말머리가 없는 게시판(자유게시판 등)
          <span className="text-xs text-gray-400">일반</span>
        )}
      </td>
      <td className="py-4 pr-4">
        <Link href={`/board/${post.boardSlug}/${post.id}`} className="group flex items-center gap-1.5">
          <span className={`line-clamp-1 group-hover:underline ${notice ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>{post.title}</span>
          {post.commentCount > 0 && <span className="shrink-0 text-xs font-bold text-zz-500">[{post.commentCount}]</span>}
          {post.hasImage && <ImageIcon size={14} className="ml-auto shrink-0 text-gray-400" />}
        </Link>
      </td>
      <td className="py-4">
        <span className="flex items-center gap-1.5">
          {author && <Avatar user={author} size={20} />}
          <span className="truncate text-xs text-gray-600">{author?.nickname}</span>
          {author && <LevelBadge level={author.level} className="hidden xl:inline-flex" />}
        </span>
      </td>
      <td className="py-4 text-center text-xs text-gray-500">{formatRelative(post.createdAt)}</td>
      <td className="py-4 text-center text-xs text-gray-500">{formatNumber(post.views)}</td>
      <td className="py-4 text-center text-xs text-gray-500">
        <span className="inline-flex items-center gap-0.5">
          <Heart size={11} />
          {post.likes}
        </span>
      </td>
    </tr>
  );
}
