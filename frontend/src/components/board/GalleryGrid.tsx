import Link from 'next/link';
import { Heart, MessageCircle } from 'lucide-react';
import type { Post } from '@/lib/types';
import { Thumb } from '@/components/ui';
import { formatRelative, thumbTone } from '@/lib/utils';

/** 갤러리형 게시판 (중고장터 등) */
export function GalleryGrid({
  items,
  cols = 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4',
}: {
  items: Post[];
  cols?: string;
}) {
  return (
    <ul className={`grid gap-4 ${cols}`}>
      {items.map((post) => {
        return (
          <li key={post.id}>
            <Link href={`/board/${post.boardSlug}/${post.id}`} className="group block">
              <Thumb
                tone={thumbTone(post) ?? 'zz'}
                className="aspect-square rounded-lg transition group-hover:brightness-110"
                label={post.category ?? undefined}
              />
              <p className="mt-2 line-clamp-1 text-sm font-medium text-gray-900 group-hover:underline">{post.title}</p>
              <p className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                <span className="truncate">{post.author?.nickname}</span>
                <span>{formatRelative(post.createdAt)}</span>
                <span className="ml-auto flex items-center gap-0.5">
                  <Heart size={11} />
                  {post.likes}
                </span>
                <span className="flex items-center gap-0.5">
                  <MessageCircle size={11} />
                  {post.commentCount}
                </span>
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
