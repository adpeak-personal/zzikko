'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import type { Comment } from '@/lib/types';
import { Avatar, Card, SellerBadge } from '@/components/ui';
import { formatRelative } from '@/lib/utils';

/** 로그인했으면 서버가 "내가 좋아요 눌렀는지" 까지 실어 보낸다 */
type Item = Comment & { liked?: boolean };

interface Me {
  id: number;
  role: string;
}

export function CommentSection({
  postId,
  postAuthorId,
  comments: initial,
  me,
}: {
  postId: number;
  /** 글쓴이에게 "작성자" 표시를 붙이려고 받는다 */
  postAuthorId?: number;
  comments: Item[];
  me: Me | null;
}) {
  const router = useRouter();
  const [comments, setComments] = useState<Item[]>(initial);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** 답글이 부모 바로 아래 오도록 정렬 — 시간순으로만 두면 멀리 떨어진다 */
  const ordered = useMemo(() => {
    const roots = comments.filter((c) => !c.parentId);
    const byParent = new Map<number, Item[]>();
    for (const c of comments) {
      if (!c.parentId) continue;
      byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
    }

    const placed = new Set<number>();
    const out: Item[] = [];
    for (const r of roots) {
      out.push(r);
      placed.add(r.id);
      for (const child of byParent.get(r.id) ?? []) {
        out.push(child);
        placed.add(child.id);
      }
    }
    // 부모가 지워진 답글도 보여야 하므로 묶이지 않은 건 뒤에 붙인다
    return [...out, ...comments.filter((c) => !placed.has(c.id))];
  }, [comments]);

  const canEdit = (c: Item) => me != null && (me.id === c.authorId || me.role === '운영진');

  const submit = async (content: string, parentId?: number) => {
    const res = await apiFetch<{ items: Item[] }>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content, parentId }),
    });
    setComments(res.items);
    router.refresh(); // 글의 댓글 수도 다시 읽어온다
  };

  const save = async (id: number, content: string) => {
    const res = await apiFetch<{ items: Item[] }>(`/comments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    });
    setComments(res.items);
  };

  const remove = async (id: number) => {
    if (!confirm('이 댓글을 삭제할까요?')) return;
    setError(null);
    try {
      await apiFetch<void>(`/comments/${id}`, { method: 'DELETE' });
      setComments((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '댓글을 삭제하지 못했어요.');
    }
  };

  const like = async (id: number) => {
    setError(null);
    try {
      const r = await apiFetch<{ liked: boolean; likes: number }>(`/comments/${id}/like`, { method: 'POST' });
      // 직접 +1 하지 않고 서버가 준 값을 쓴다 — 다른 기기에서 누른 것과 어긋나지 않게
      setComments((prev) => prev.map((c) => (c.id === id ? { ...c, liked: r.liked, likes: r.likes } : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '처리하지 못했어요.');
    }
  };

  return (
    <Card className="px-6 py-5">
      <h2 className="text-base font-bold text-gray-900">
        댓글 <span className="text-zz-600">{comments.length}</span>
      </h2>

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {ordered.length > 0 ? (
        <ul className="mt-4 divide-y divide-gray-100">
          {ordered.map((comment) => (
            <li key={comment.id} className={`py-4 ${comment.parentId ? 'pl-8' : ''}`}>
              <div className="flex items-center gap-2">
                {comment.author && <Avatar user={comment.author} size={26} />}
                <span className="text-sm font-bold text-gray-900">{comment.author?.nickname}</span>
                {comment.authorId === postAuthorId && (
                  <span className="rounded bg-zz-50 px-1.5 py-0.5 text-[11px] font-medium text-zz-700">작성자</span>
                )}
                {comment.author?.role === '판매자' && <SellerBadge />}
                <span suppressHydrationWarning className="text-xs text-gray-400">
                  {formatRelative(comment.createdAt)}
                </span>
              </div>

              {editing === comment.id ? (
                <CommentBox
                  className="mt-2"
                  defaultValue={comment.content}
                  submitLabel="수정"
                  autoFocus
                  onCancel={() => setEditing(null)}
                  onSubmit={async (text) => {
                    await save(comment.id, text);
                    setEditing(null);
                  }}
                />
              ) : (
                <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-gray-700">{comment.content}</p>
              )}

              <p className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                {me ? (
                  <button
                    type="button"
                    onClick={() => void like(comment.id)}
                    aria-pressed={Boolean(comment.liked)}
                    className={`inline-flex items-center gap-1 ${comment.liked ? 'text-zz-600' : 'hover:text-zz-600'}`}
                  >
                    <Heart size={12} fill={comment.liked ? 'currentColor' : 'none'} /> {comment.likes}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Heart size={12} /> {comment.likes}
                  </span>
                )}

                {me && !comment.parentId && (
                  <button
                    type="button"
                    onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                    className="hover:text-gray-600"
                  >
                    {replyTo === comment.id ? '답글취소' : '답글쓰기'}
                  </button>
                )}
                {canEdit(comment) && editing !== comment.id && (
                  <button type="button" onClick={() => setEditing(comment.id)} className="hover:text-gray-600">
                    수정
                  </button>
                )}
                {canEdit(comment) && (
                  <button type="button" onClick={() => void remove(comment.id)} className="hover:text-red-600">
                    삭제
                  </button>
                )}
              </p>

              {replyTo === comment.id && (
                <CommentBox
                  className="mt-2"
                  placeholder={`${comment.author?.nickname ?? ''} 님에게 답글 남기기`}
                  submitLabel="답글 등록"
                  autoFocus
                  onCancel={() => setReplyTo(null)}
                  onSubmit={async (text) => {
                    await submit(text, comment.id);
                    setReplyTo(null);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-8 text-center text-sm text-gray-400">첫 댓글을 남겨보세요.</p>
      )}

      {me ? (
        <CommentBox
          className="mt-4"
          rows={3}
          submitLabel="댓글 등록"
          placeholder="댓글을 남겨보세요. 조건을 물어볼 때는 현재 요금제와 약정 만료일을 함께 적어주세요."
          onSubmit={(text) => submit(text)}
        />
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

/**
 * 댓글 입력 상자 — 새 댓글 · 답글 · 수정이 모두 이걸 쓴다.
 *
 * 전송 결과(목록 갱신)는 부모가 책임지고, 여기서는 입력값과 전송 중 상태만 본다.
 */
function CommentBox({
  defaultValue = '',
  placeholder = '댓글을 입력하세요.',
  submitLabel = '등록',
  rows = 2,
  autoFocus,
  className,
  onSubmit,
  onCancel,
}: {
  defaultValue?: string;
  placeholder?: string;
  submitLabel?: string;
  rows?: number;
  autoFocus?: boolean;
  className?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const content = value.trim();
    if (!content) return setError('내용을 입력해 주세요.');

    setBusy(true);
    setError(null);
    try {
      await onSubmit(content);
      setValue('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          // 줄바꿈은 그냥 엔터 — 전송은 Ctrl/⌘+Enter 로 (실수로 올라가는 걸 막는다)
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send();
          }
        }}
        rows={rows}
        maxLength={2000}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-zz-400"
      />
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="mr-auto text-[11px] text-gray-300">Ctrl + Enter 로 등록</span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
        )}
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy}
          className="rounded-xl bg-zz-600 px-5 py-2.5 font-bold text-white hover:bg-zz-700 disabled:opacity-50"
        >
          {busy ? '처리 중…' : submitLabel}
        </button>
      </div>
    </div>
  );
}
