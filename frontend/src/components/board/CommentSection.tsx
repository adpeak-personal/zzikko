'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import type { Comment } from '@/lib/types';
import { Avatar, Card, SellerBadge } from '@/components/ui';
import { formatRelative } from '@/lib/utils';

export function CommentSection({
  postId,
  comments: initial,
  canWrite,
}: {
  postId: number;
  comments: Comment[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initial);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return;

    setSending(true);
    setError(null);
    try {
      const result = await apiFetch<{ items: Comment[] }>(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim() }),
      });
      setComments(result.items);
      setContent('');
      router.refresh(); // 글의 댓글 수도 다시 읽어온다
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '댓글을 남기지 못했어요.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="px-6 py-5">
      <h2 className="text-base font-bold text-gray-900">
        댓글 <span className="text-zz-600">{comments.length}</span>
      </h2>

      {comments.length > 0 ? (
        <ul className="mt-4 divide-y divide-gray-100">
          {comments.map((comment) => (
            <li key={comment.id} className={`py-4 ${comment.parentId ? 'pl-8' : ''}`}>
              <div className="flex items-center gap-2">
                {comment.author && <Avatar user={comment.author} size={26} />}
                <span className="text-sm font-bold text-gray-900">{comment.author?.nickname}</span>
                {comment.author?.role === '판매자' && <SellerBadge />}
                <span className="text-xs text-gray-400">{formatRelative(comment.createdAt)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-700">{comment.content}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400">
                <Heart size={12} /> {comment.likes}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-gray-400">첫 댓글을 남겨보세요.</p>
      )}

      {canWrite ? (
        <form onSubmit={onSubmit} className="mt-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="댓글을 남겨보세요. 조건을 물어볼 때는 현재 요금제와 약정 만료일을 함께 적어주세요."
            className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-zz-400"
          />
          {error && (
            <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              disabled={sending || !content.trim()}
              className="rounded-xl bg-zz-600 px-5 py-2.5 font-bold text-white hover:bg-zz-700 disabled:opacity-50"
            >
              {sending ? '등록 중…' : '댓글 등록'}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-xl bg-gray-50 px-4 py-3.5 text-sm text-gray-500">
          댓글을 남기려면{' '}
          <Link href="/login" className="font-semibold text-zz-600 hover:underline">
            로그인
          </Link>
          이 필요합니다.
        </p>
      )}
    </Card>
  );
}
