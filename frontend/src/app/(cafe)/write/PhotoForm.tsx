'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { JSONContent } from '@tiptap/core';
import { PhotoUploader, type PhotoItem } from '@/components/photo-uploader';
import { uploadImage } from '@/lib/upload';
import { ApiError, apiFetch } from '@/lib/api';
import type { Post } from '@/lib/types';
import type { Board, BoardGroup } from '@/lib/types';
import { BoardSelect } from './BoardSelect';

/**
 * 사진 중심 게시판(writeMode: 'photo')의 작성 폼.
 *
 * 화면은 에디터와 전혀 다르지만 **저장 형식은 같다** — 사진과 글을
 * 똑같은 ProseMirror JSON 으로 바꿔서 보낸다. 그래야 읽기 화면·앱·검색이
 * 작성 방식에 따라 갈라지지 않는다.
 */
function toDoc(photos: PhotoItem[], text: string): JSONContent {
  const content: JSONContent[] = [];

  // 글이 먼저, 사진이 그 다음
  for (const line of text.split('\n')) {
    content.push(line.trim() ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' });
  }

  for (const photo of photos) {
    content.push({ type: 'image', attrs: { src: photo.url, alt: photo.caption || '' } });
    if (photo.caption) {
      content.push({
        type: 'paragraph',
        attrs: { textAlign: 'center' },
        content: [{ type: 'text', text: photo.caption }],
      });
    }
  }

  return { type: 'doc', content };
}

export function PhotoForm({ boardGroups, board }: { boardGroups: BoardGroup[]; board: Board }) {
  const router = useRouter();
  const [boardSlug, setBoardSlug] = useState(board.slug);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const allBoards = boardGroups.flatMap((group) => group.boards);
  const currentBoard = allBoards.find((b) => b.slug === boardSlug) ?? board;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) return setError('제목을 입력해 주세요.');
    if (photos.length === 0) return setError('사진을 한 장 이상 올려주세요.');

    setSending(true);
    try {
      const post = await apiFetch<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({
          boardSlug,
          title: title.trim(),
          category: category || undefined,
          contentJson: toDoc(photos, text),
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
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
      <BoardSelect
        boardGroups={boardGroups}
        boardSlug={boardSlug}
        category={category}
        categories={currentBoard.categories}
        onBoardChange={(slug) => {
          setBoardSlug(slug);
          setCategory('');
        }}
        onCategoryChange={setCategory}
      />

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder="제목을 입력해 주세요"
        className="w-full border-b border-gray-200 px-1 py-3 text-lg font-semibold outline-none focus:border-zz-500"
      />

      <PhotoUploader photos={photos} onChange={setPhotos} uploadImage={uploadImage} maxCount={30} />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        maxLength={5000}
        placeholder={'설명을 남겨주세요.\n· 중고 거래 글은 기종, 사용 기간, 상태, 거래 방법을 적어주시면 좋아요.'}
        className="w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-[15px] leading-7 outline-none focus:border-zz-400"
      />

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
