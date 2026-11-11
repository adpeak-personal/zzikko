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
import { DraftBanner } from './DraftBanner';
import { clearDraft, sinceLabel, useAutoDraft, usePendingDraft } from './useDraft';

const PLACEHOLDER =
  '내용을 입력하세요.\n\n· 시세 글에는 할부원금, 요금제와 유지 기간, 부가서비스 조건을 함께 적어주세요.\n· 질문할 때는 현재 요금제와 약정 만료일, 원하는 기종을 적으면 답변이 빨라요.';

/** 임시저장에 담는 내용 — 게시판은 키에 들어가므로 따로 담지 않는다 */
interface Draft {
  category: string;
  title: string;
  doc: JSONContent;
}

/**
 * 에디터로 쓰는 일반 글 작성 폼.
 *
 * `editing` 을 넘기면 수정 모드가 된다 — 화면은 같고 전송만 PATCH 로 바뀐다.
 */
export function PostForm({
  boardGroups,
  board,
  editing,
}: {
  boardGroups: BoardGroup[];
  board: Board;
  editing?: Post;
}) {
  const router = useRouter();
  const [boardSlug, setBoardSlug] = useState(editing?.boardSlug ?? board.slug);
  const [category, setCategory] = useState(editing?.category ?? '');
  const [title, setTitle] = useState(editing?.title ?? '');
  const [content, setContent] = useState<{ doc: JSONContent; empty: boolean }>(() => {
    const doc = (editing?.contentJson as JSONContent | undefined) ?? { type: 'doc', content: [] };
    // 수정일 때는 아직 onChange 가 안 울렸어도 비어 있지 않다
    return { doc, empty: !editing?.contentJson };
  });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // 수정과 새 글의 임시저장은 서로 다른 칸에 담는다
  const draftKey = editing ? `post:edit:${editing.id}` : `post:new:${boardSlug}`;
  const { pending, decided, settle } = usePendingDraft<Draft>(draftKey);
  // 에디터에 내용을 넣으려면 다시 그려야 한다 (defaultValue 는 처음 한 번만 읽힌다)
  const [editorKey, setEditorKey] = useState(0);

  const { savedAt, saveNow } = useAutoDraft<Draft>(
    draftKey,
    { category, title, doc: content.doc },
    // 아무것도 안 쓴 상태를 저장해 둘 이유는 없다
    decided && (title.trim().length > 0 || !content.empty),
  );

  const restore = () => {
    if (!pending) return;
    setCategory(pending.data.category);
    setTitle(pending.data.title);
    setContent({ doc: pending.data.doc, empty: false });
    setEditorKey((k) => k + 1);
    settle();
  };

  const discard = () => {
    clearDraft(draftKey);
    settle();
  };

  // 직접 누른 임시저장은 지금 화면을 덮어쓰겠다는 뜻이다 — 복구 안내도 같이 치운다
  const saveManually = () => {
    settle();
    saveNow();
  };

  const allBoards = boardGroups.flatMap((group) => group.boards);
  const currentBoard = allBoards.find((b) => b.slug === boardSlug) ?? board;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) return setError('제목을 입력해 주세요.');
    if (content.empty) return setError('내용을 입력해 주세요.');

    setSending(true);
    try {
      const post = editing
        ? await apiFetch<Post>(`/posts/${editing.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              // 수정에서는 게시판을 바꾸지 않는다 — 말머리를 지우면 null 로 보낸다
              title: title.trim(),
              category: category || null,
              contentJson: content.doc,
            }),
          })
        : await apiFetch<Post>('/posts', {
            method: 'POST',
            body: JSON.stringify({
              boardSlug,
              title: title.trim(),
              category: category || undefined,
              // 저장 정본은 JSON — 서버가 평문·썸네일을 여기서 뽑아낸다
              contentJson: content.doc,
            }),
          });

      // 올라갔으니 임시저장은 남길 이유가 없다
      clearDraft(draftKey);
      router.replace(`/board/${post.boardSlug}/${post.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : editing ? '글을 수정하지 못했어요.' : '글을 등록하지 못했어요.',
      );
      setSending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      {pending && <DraftBanner savedAt={pending.savedAt} onRestore={restore} onDiscard={discard} />}

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
        lockBoard={Boolean(editing)}
      />

      <input
        name="title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        placeholder="제목을 입력해 주세요"
        className="w-full border-b border-gray-200 px-1 py-3 text-lg font-semibold outline-none focus:border-zz-500"
      />

      <RichEditor
        key={editorKey}
        defaultValue={editorKey > 0 ? content.doc : ((editing?.contentJson as JSONContent | undefined) ?? undefined)}
        placeholder={PLACEHOLDER}
        uploadImage={uploadImage}
        onChange={(doc, empty) => setContent({ doc, empty })}
      />

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 pt-4">
        {savedAt ? (
          <span className="text-xs text-gray-400">임시저장됨 · {sinceLabel(savedAt)}</span>
        ) : editing ? (
          <span className="text-xs text-gray-400">수정해도 등록 시간은 그대로 유지돼요.</span>
        ) : (
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" defaultChecked className="accent-zz-600" /> 댓글 허용
          </label>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={saveManually}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            임시저장
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-zz-600 px-5 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-60"
          >
            {sending ? (editing ? '저장 중…' : '등록 중…') : editing ? '수정 완료' : '등록'}
          </button>
        </div>
      </div>
    </form>
  );
}
