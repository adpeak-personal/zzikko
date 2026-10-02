'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/core';
import { RichEditor } from '@/components/editor';
import { uploadImage } from '@/lib/upload';
import { ApiError, apiFetch } from '@/lib/api';
import type { Post } from '@/lib/types';
import type { Board, BoardGroup } from '@/lib/types';
import { BoardSelect } from './BoardSelect';

const PLACEHOLDER =
  '내용을 입력하세요.\n\n· 시세 글에는 할부원금, 요금제와 유지 기간, 부가서비스 조건을 함께 적어주세요.\n· 질문할 때는 현재 요금제와 약정 만료일, 원하는 기종을 적으면 답변이 빨라요.';

/** 에디터로 쓰는 일반 글 작성 폼 */
export function PostForm({ boardGroups, board }: { boardGroups: BoardGroup[]; board: Board }) {
  const router = useRouter();
  const [boardSlug, setBoardSlug] = useState(board.slug);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<{ doc: JSONContent; empty: boolean }>({
    doc: { type: 'doc', content: [] },
    empty: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const allBoards = boardGroups.flatMap((group) => group.boards);
  const currentBoard = allBoards.find((b) => b.slug === boardSlug) ?? board;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) return setError('제목을 입력해 주세요.');
    if (content.empty) return setError('내용을 입력해 주세요.');

    setSending(true);
    try {
      const post = await apiFetch<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({
          boardSlug,
          title: title.trim(),
          category: category || undefined,
          // 저장 정본은 JSON — 서버가 평문·썸네일을 여기서 뽑아낸다
          contentJson: content.doc,
        }),
      });
      router.push(`/board/${post.boardSlug}/${post.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '글을 등록하지 못했어요.');
      setSending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <BoardSelect
        boardGroups={boardGroups}
        boardSlug={boardSlug}
        category={category}
        categories={currentBoard.categories}
        onBoardChange={(slug) => {
          setBoardSlug(slug);
          setCategory(''); // 게시판이 바뀌면 말머리도 초기화
        }}
        onCategoryChange={setCategory}
      />

      <input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder="제목을 입력해 주세요"
        className="w-full border-b border-gray-200 px-1 py-3 text-lg font-semibold outline-none focus:border-zz-500"
      />

      <RichEditor placeholder={PLACEHOLDER} uploadImage={uploadImage} onChange={(doc, empty) => setContent({ doc, empty })} />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" defaultChecked className="accent-zz-600" /> 댓글 허용
        </label>
        <button
          type="submit"
          disabled={sending}
          className="rounded-lg bg-zz-600 px-5 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-60"
        >
          {sending ? '등록 중…' : '등록'}
        </button>
      </div>
    </form>
  );
}
