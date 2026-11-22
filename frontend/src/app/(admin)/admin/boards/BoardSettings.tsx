'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ApiError, apiFetch } from '@/lib/api';
import { Check, ChevronDown, Pencil, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Board, BoardGroup, BoardType, WriteMode } from '@/lib/types';

export type AdminBoard = Board & { postCount: number };
export type AdminBoardGroup = Omit<BoardGroup, 'boards'> & { boards: AdminBoard[] };

const TYPE_LABEL: Record<BoardType, string> = {
  list: '목록형',
  deal: '시세표형',
  gallery: '갤러리형',
  news: '매거진형 (기사)',
  spec: '기종 사양 비교',
};

/** 글이 아니라 어드민에서 관리하는 콘텐츠를 쓰는 형식 */
const CONTENT_TYPES: BoardType[] = ['news', 'spec'];

const WRITE_MODE_LABEL: Record<WriteMode, string> = {
  editor: '에디터 (서식·표·본문 이미지)',
  photo: '사진 업로더 (사진 + 글만)',
};

/** 말머리 입력 — 칩으로 보여주고 Enter 로 추가 */
function CategoryInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const name = draft.trim();
    if (!name) return;
    if (value.includes(name)) return setDraft('');
    onChange([...value, name]);
    setDraft('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-gray-200 px-2 py-1.5 focus-within:border-zz-400">
      {value.map((item) => (
        <span key={item} className="flex items-center gap-1 rounded bg-zz-50 px-2 py-0.5 text-xs text-zz-700">
          {item}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== item))} aria-label={`${item} 삭제`}>
            <X size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault(); // 폼 제출 대신 말머리 추가
            add();
          }
          // 빈 입력에서 Backspace 면 마지막 칩 삭제
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? '추가…' : '말머리 없음 (입력 후 Enter)'}
        className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none"
      />
    </div>
  );
}

function BoardCard({ board }: { board: AdminBoard }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);
  const [type, setType] = useState<BoardType>(board.type);
  const [writeMode, setWriteMode] = useState<WriteMode>(board.writeMode ?? 'editor');
  const [sellerOnly, setSellerOnly] = useState(board.sellerOnly ?? false);
  const [categories, setCategories] = useState<string[]>(board.categories ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty =
    name !== board.name ||
    description !== board.description ||
    type !== board.type ||
    writeMode !== (board.writeMode ?? 'editor') ||
    sellerOnly !== (board.sellerOnly ?? false) ||
    JSON.stringify(categories) !== JSON.stringify(board.categories ?? []);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('게시판 이름을 입력해 주세요.');

    setSaving(true);
    try {
      await apiFetch(`/admin/boards/${board.slug}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), description: description.trim(), type, writeMode, categories, sellerOnly }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh(); // 사이드바·메뉴가 새 이름으로 다시 그려지도록
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-gray-50"
      >
        <ChevronDown size={15} className={cn('shrink-0 text-gray-400 transition', open && 'rotate-180')} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-gray-900">{board.name}</span>
          <span className="mt-0.5 block truncate text-xs text-gray-400">
            /{board.slug} · {TYPE_LABEL[board.type]} · {board.writeMode === 'photo' ? '사진 업로더' : '에디터'}
            {board.categories?.length ? ` · 말머리 ${board.categories.length}개` : ' · 말머리 없음'}
          </span>
        </span>
        <span className="shrink-0 text-xs text-gray-500">글 {board.postCount}</span>
        {dirty && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] text-amber-800">수정됨</span>}
      </button>

      {open && (
        <div className="space-y-3 bg-gray-50/70 px-5 pb-4 pt-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">이름</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-zz-400"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-600">목록 형식</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as BoardType)}
                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-zz-400"
              >
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {CONTENT_TYPES.includes(type) ? (
            <p className="rounded-lg bg-zz-50 px-3 py-2.5 text-xs leading-relaxed text-zz-700">
              이 형식은 회원 글이 아니라 어드민에서 관리하는 콘텐츠를 보여줍니다. 내용은{' '}
              <Link href={type === 'news' ? '/admin/news' : '/admin/specs'} className="font-bold underline">
                {type === 'news' ? 'IT 소식 관리' : '기종 사양 관리'}
              </Link>{' '}
              에서 등록·수정하세요. 아래 글 작성 방식과 말머리는 적용되지 않습니다.
            </p>
          ) : null}

          <label className="block">
            <span className="text-xs font-medium text-gray-600">글 작성 방식</span>
            <select
              value={writeMode}
              onChange={(e) => setWriteMode(e.target.value as WriteMode)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-zz-400"
            >
              {Object.entries(WRITE_MODE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-gray-400">
              방식을 바꿔도 기존 글은 그대로 보입니다 — 저장 형식이 같습니다.
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-lg bg-white px-3 py-2.5">
            <input
              type="checkbox"
              checked={sellerOnly}
              onChange={(e) => setSellerOnly(e.target.checked)}
              className="mt-0.5 accent-zz-600"
            />
            <span>
              <span className="block text-xs font-medium text-gray-700">판매자 전용</span>
              <span className="block text-[11px] text-gray-400">
                인증된 판매자만 글을 쓸 수 있습니다. 성지 시세표처럼 조건을 올리는 게시판에 켜세요.
              </span>
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600">설명</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-zz-400"
            />
          </label>

          <div>
            <span className="text-xs font-medium text-gray-600">말머리</span>
            <div className="mt-1">
              <CategoryInput value={categories} onChange={setCategories} />
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              목록 첫 칸에 표시됩니다. 비워두면 글쓰기에서 말머리 선택이 사라지고 목록에는 &apos;일반&apos;으로 나옵니다.
            </p>
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-emerald-600">
                <Check size={13} /> 저장됨
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!dirty || saving}
              className="rounded-lg bg-zz-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-50"
            >
              저장
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** 대분류 제목 — 연필을 누르면 그 자리에서 이름을 고친다 */
function GroupHeader({ group }: { group: AdminBoardGroup }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const cancel = () => {
    setName(group.name);
    setError(null);
    setEditing(false);
  };

  const save = async () => {
    const next = name.trim();
    if (!next) return setError('대분류 이름을 입력해 주세요.');
    if (next === group.name) return cancel();

    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/board-groups/${group.id}`, { method: 'PATCH', body: JSON.stringify({ name: next }) });
      setEditing(false);
      router.refresh(); // 사이드바·메뉴가 새 이름으로 다시 그려지도록
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장하지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <h2 className="flex items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-bold text-gray-700">
        {group.name}
        <span className="font-normal text-gray-400">{group.boards.length}개</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`${group.name} 이름 바꾸기`}
          className="ml-1 rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
        >
          <Pencil size={13} />
        </button>
      </h2>
    );
  }

  return (
    <div className="border-b border-gray-200 bg-gray-50 px-5 py-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="flex items-center gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && cancel()}
          maxLength={30}
          autoFocus
          aria-label="대분류 이름"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-bold outline-none focus:border-zz-400"
        />
        <button
          type="submit"
          disabled={saving}
          className="shrink-0 rounded-lg bg-zz-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zz-700 disabled:opacity-50"
        >
          저장
        </button>
        <button
          type="button"
          onClick={cancel}
          className="shrink-0 rounded-lg px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-200"
        >
          취소
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** 새로 만들 때 고를 수 있는 형식 — 기사·기종 형식은 사이트에 하나씩만 둔다 */
const NEW_BOARD_TYPES: BoardType[] = ['list', 'deal', 'gallery'];

/** 대분류 맨 아래 '게시판 추가' — 만들면 그 대분류의 끝에 붙는다 */
function AddBoardForm({ groupId }: { groupId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<BoardType>('list');
  const [writeMode, setWriteMode] = useState<WriteMode>('editor');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName('');
    setSlug('');
    setType('list');
    setWriteMode('editor');
    setDescription('');
    setError(null);
    setOpen(false);
  };

  const create = async () => {
    setError(null);
    if (!name.trim()) return setError('게시판 이름을 입력해 주세요.');
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(slug.trim())) {
      return setError('주소는 영문 소문자·숫자·하이픈 2~40자로 적어주세요. (예: usim)');
    }

    setSaving(true);
    try {
      await apiFetch('/admin/boards', {
        method: 'POST',
        body: JSON.stringify({ groupId, name: name.trim(), slug: slug.trim(), type, writeMode, description: description.trim() }),
      });
      reset();
      router.refresh(); // 목록·사이드바에 새 게시판이 나오도록
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '만들지 못했어요.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 border-t border-gray-100 px-5 py-2.5 text-left text-xs font-medium text-gray-500 hover:bg-gray-50 hover:text-zz-700"
      >
        <Plus size={14} /> 게시판 추가
      </button>
    );
  }

  const field = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-zz-400';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create();
      }}
      className="space-y-3 border-t border-gray-200 bg-zz-50/40 px-5 py-4"
    >
      <p className="text-xs font-bold text-gray-700">새 게시판</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">이름</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoFocus className={field} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">주소</span>
          <div className="mt-1 flex items-center rounded-lg border border-gray-200 bg-white focus-within:border-zz-400">
            <span className="pl-3 text-sm text-gray-400">/board/</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              maxLength={40}
              placeholder="usim"
              className="min-w-0 flex-1 bg-transparent py-2 pr-3 text-sm outline-none"
            />
          </div>
          <span className="mt-1 block text-[11px] text-gray-400">
            영문 소문자·숫자·하이픈. 글 주소에 들어가므로 만든 뒤에는 바꿀 수 없습니다.
          </span>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">목록 형식</span>
          <select value={type} onChange={(e) => setType(e.target.value as BoardType)} className={field}>
            {NEW_BOARD_TYPES.map((value) => (
              <option key={value} value={value}>
                {TYPE_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">글 작성 방식</span>
          <select value={writeMode} onChange={(e) => setWriteMode(e.target.value as WriteMode)} className={field}>
            {Object.entries(WRITE_MODE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">설명</span>
        <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} className={field} />
      </label>
      <p className="text-[11px] text-gray-400">말머리·판매자 전용은 만든 뒤 게시판을 펼쳐서 정합니다.</p>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={reset} className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100">
          취소
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-zz-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-50"
        >
          만들기
        </button>
      </div>
    </form>
  );
}

export function BoardSettings({ groups }: { groups: AdminBoardGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <GroupHeader key={group.name} group={group} />
          <ul>
            {group.boards.map((board) => (
              <BoardCard key={board.slug} board={board} />
            ))}
          </ul>
          <AddBoardForm groupId={group.id} />
        </section>
      ))}
    </div>
  );
}
