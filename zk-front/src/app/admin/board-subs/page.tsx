"use client";

import { useMemo, useState } from "react";
import { CATEGORIES } from "@/config/navigation";
import { useBoardSubs } from "@/service/board-subs/queries";
import {
  useCreateBoardSub,
  useUpdateBoardSub,
  useDeleteBoardSub,
  useReorderBoardSubs,
} from "@/service/board-subs/mutations";
import type { BoardSub } from "@/service/board-subs/types";

// 서브를 갖고 싶은 게시판만 리스트에 노출. 필요하면 어드민이 여기서 늘려도 됨.
// 셀렉트만 늘리면 UI 는 그대로 동작 — 새로 등록 후 서브 추가 → /category/{board}/{sub} 자동.
const BOARD_OPTIONS = ["community", "reviews"] as const;
type BoardOption = (typeof BOARD_OPTIONS)[number];

function isValidSlug(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(s);
}

export default function BoardSubsAdminPage() {
  const [board, setBoard] = useState<BoardOption>("community");
  const { data, isLoading, isError, refetch } = useBoardSubs(board);
  const createMut = useCreateBoardSub();
  const updateMut = useUpdateBoardSub();
  const deleteMut = useDeleteBoardSub();
  const reorderMut = useReorderBoardSubs();

  const items = useMemo(() => data?.items ?? [], [data]);

  // 신규 폼 상태
  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [newHidden, setNewHidden] = useState(false);

  // 인라인 편집 상태 (id → 편집 중인 값)
  const [editing, setEditing] = useState<Record<number, Partial<BoardSub>>>({});

  const boardLabel = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.slug === board);
    return cat?.title ?? board;
  }, [board]);

  async function handleCreate() {
    const slug = newSlug.trim();
    const title = newTitle.trim();
    if (!isValidSlug(slug)) {
      alert("slug 는 영문 소문자/숫자/하이픈만 허용됩니다 (예: hotdeal, offline-review).");
      return;
    }
    if (!title) {
      alert("제목을 입력하세요.");
      return;
    }
    try {
      await createMut.mutateAsync({
        board_slug: board,
        slug,
        title,
        icon: newIcon.trim() || null,
        hidden_from_nav: newHidden ? 1 : 0,
      });
      setNewSlug("");
      setNewTitle("");
      setNewIcon("");
      setNewHidden(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "추가에 실패했습니다.");
    }
  }

  function startEdit(sub: BoardSub) {
    setEditing((prev) => ({
      ...prev,
      [sub.id]: {
        title: sub.title,
        icon: sub.icon ?? "",
        hidden_from_nav: sub.hidden_from_nav,
      },
    }));
  }

  function cancelEdit(id: number) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveEdit(id: number) {
    const patch = editing[id];
    if (!patch) return;
    try {
      await updateMut.mutateAsync({
        id,
        title: patch.title as string | undefined,
        icon: (patch.icon as string | undefined) ?? null,
        hidden_from_nav: patch.hidden_from_nav as 0 | 1,
      });
      cancelEdit(id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "수정에 실패했습니다.");
    }
  }

  async function handleDelete(sub: BoardSub) {
    if (!confirm(`"${sub.title}" 서브를 삭제할까요?\n(참조 게시글이 있으면 삭제 안 됨)`)) return;
    try {
      await deleteMut.mutateAsync(sub.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "삭제에 실패했습니다.");
    }
  }

  // 위/아래로 이동 — 현재 정렬 배열 재정렬 후 sort_order 값을 10씩 재부여해 서버에 일괄 전송.
  async function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const arr = [...items];
    const [moved] = arr.splice(index, 1);
    arr.splice(target, 0, moved);
    const payload = arr.map((it, i) => ({ id: it.id, sort_order: (i + 1) * 10 }));
    try {
      await reorderMut.mutateAsync({ items: payload });
    } catch (e) {
      alert(e instanceof Error ? e.message : "정렬 반영에 실패했습니다.");
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">서브카테고리 관리</h1>
          <p className="text-sm text-slate-500 mt-1">
            게시판별 서브 탭 (URL: <code>/category/&#123;board&#125;/&#123;sub&#125;</code>) 관리.
            slug 는 immutable — 오탈자 나면 삭제 후 재생성.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-slate-600">상위 게시판:</label>
          <select
            value={board}
            onChange={(e) => setBoard(e.target.value as BoardOption)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-bold bg-white"
          >
            {BOARD_OPTIONS.map((slug) => {
              const cat = CATEGORIES.find((c) => c.slug === slug);
              return (
                <option key={slug} value={slug}>
                  {cat?.title ?? slug} ({slug})
                </option>
              );
            })}
          </select>
        </div>
      </header>

      {/* 신규 추가 폼 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-lg font-extrabold mb-3">
          &laquo;{boardLabel}&raquo; 에 서브 추가
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-[140px_160px_1fr_auto_auto] gap-2 items-center">
          <input
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="아이콘 (이모지)"
            maxLength={20}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
            placeholder="slug (예: hotdeal)"
            maxLength={50}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
          />
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="표시 이름 (예: 핫딜 후기)"
            maxLength={100}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <label className="flex items-center gap-2 text-sm font-bold text-slate-600 px-2">
            <input
              type="checkbox"
              checked={newHidden}
              onChange={(e) => setNewHidden(e.target.checked)}
            />
            어드민만
          </label>
          <button
            onClick={handleCreate}
            disabled={createMut.isPending}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-black px-4 py-2 rounded-lg"
          >
            {createMut.isPending ? "추가 중…" : "추가"}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          어드민 전용: 체크 시 일반 유저에게는 탭이 숨겨지고 어드민에게만 보임. URL 접근은 열려 있음.
        </p>
      </section>

      {/* 목록 */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">서브 목록 ({items.length})</h2>
          <button
            onClick={() => refetch()}
            className="text-xs font-bold text-slate-500 hover:text-slate-900"
          >
            🔄 새로고침
          </button>
        </div>

        {isLoading && <div className="p-6 text-center text-sm text-slate-500">불러오는 중…</div>}
        {isError && (
          <div className="p-6 text-center text-sm text-rose-600">
            서브 목록을 불러오지 못했습니다.
          </div>
        )}
        {!isLoading && !isError && items.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">
            아직 서브가 없습니다. 위 폼에서 추가하세요.
          </div>
        )}

        <ul className="divide-y divide-slate-100">
          {items.map((sub, i) => {
            const edit = editing[sub.id];
            const isEditing = !!edit;
            return (
              <li key={sub.id} className="px-5 py-3 flex items-center gap-3">
                {/* 정렬 */}
                <div className="flex flex-col">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reorderMut.isPending}
                    className="text-slate-400 hover:text-slate-900 disabled:opacity-30 text-xs leading-none px-1"
                    aria-label="위로"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1 || reorderMut.isPending}
                    className="text-slate-400 hover:text-slate-900 disabled:opacity-30 text-xs leading-none px-1"
                    aria-label="아래로"
                  >
                    ▼
                  </button>
                </div>

                {/* 아이콘 */}
                <div className="w-10 text-center text-xl">
                  {isEditing ? (
                    <input
                      value={(edit.icon as string) ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [sub.id]: { ...prev[sub.id], icon: e.target.value },
                        }))
                      }
                      className="w-10 border border-slate-300 rounded px-1 py-0.5 text-center text-base"
                      maxLength={20}
                    />
                  ) : (
                    sub.icon ?? "—"
                  )}
                </div>

                {/* slug (읽기 전용) */}
                <div className="w-32 text-xs font-mono text-slate-500 truncate" title={sub.slug}>
                  {sub.slug}
                </div>

                {/* 제목 */}
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <input
                      value={(edit.title as string) ?? ""}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [sub.id]: { ...prev[sub.id], title: e.target.value },
                        }))
                      }
                      className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
                      maxLength={100}
                    />
                  ) : (
                    <span className="text-sm font-bold text-slate-900">{sub.title}</span>
                  )}
                </div>

                {/* hidden_from_nav */}
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <input
                    type="checkbox"
                    checked={
                      isEditing
                        ? Number(edit.hidden_from_nav) === 1
                        : sub.hidden_from_nav === 1
                    }
                    onChange={(e) => {
                      const v = e.target.checked ? 1 : 0;
                      if (isEditing) {
                        setEditing((prev) => ({
                          ...prev,
                          [sub.id]: { ...prev[sub.id], hidden_from_nav: v },
                        }));
                      } else {
                        // 즉시 저장 (편집 모드 아닐 때 토글 편의)
                        updateMut.mutate({ id: sub.id, hidden_from_nav: v });
                      }
                    }}
                  />
                  어드민만
                </label>

                {/* 액션 */}
                <div className="flex items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => saveEdit(sub.id)}
                        disabled={updateMut.isPending}
                        className="text-xs font-black bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => cancelEdit(sub.id)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-900 px-2"
                      >
                        취소
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(sub)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-500 px-2"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(sub)}
                        disabled={deleteMut.isPending}
                        className="text-xs font-bold text-rose-600 hover:text-rose-500 disabled:opacity-50 px-2"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
