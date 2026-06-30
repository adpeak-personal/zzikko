"use client";

import { useMemo, useState } from "react";
import { useAliases } from "@/service/aliases/queries";
import {
  useBulkCreateAliases,
  useBulkDeleteAliases,
  useToggleAlias,
} from "@/service/aliases/mutations";

// 기본 대상 — 마스터(어드민) 계정 id. 추후 다른 계정도 관리하려면 selector 추가.
const DEFAULT_USER_ID = 13;

// 5개 시드 제안 (텍스트박스에 미리 채워 둠)
const SEED_NICKNAMES = ["폰박사", "IT덕후", "통신요정", "가성비헌터", "시세분석가"];

function sanitize(raw: string): string {
  return raw
    .replace(/[^가-힣ᄀ-ᇿ㄰-㆏a-zA-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitNames(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map(sanitize)
        .filter((s) => s.length > 0),
    ),
  );
}

export default function AliasesPage() {
  const [userId, setUserId] = useState(DEFAULT_USER_ID);
  const [raw, setRaw] = useState(SEED_NICKNAMES.join(", "));
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, isError } = useAliases(userId);
  const createMut = useBulkCreateAliases();
  const deleteMut = useBulkDeleteAliases();
  const toggleMut = useToggleAlias();

  const items = useMemo(() => data?.items ?? [], [data]);
  const parsed = useMemo(() => splitNames(raw), [raw]);

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((a) => a.id)));
  }

  async function handleAdd() {
    if (parsed.length === 0) return;
    const r = await createMut.mutateAsync({ user_id: userId, nicknames: parsed });
    if (r.skipped > 0) {
      alert(
        `${r.inserted}개 추가, ${r.skipped}개 건너뜀\n(이미 users 또는 다른 alias 에 있는 닉네임)\n\n` +
          `건너뛴 닉네임:\n- ${r.skipped_nicknames.join("\n- ")}`,
      );
    }
    setRaw("");
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 alias 를 삭제할까요?`)) return;
    await deleteMut.mutateAsync({ ids: Array.from(selectedIds) });
    setSelectedIds(new Set());
  }

  async function handleDeleteOne(id: number) {
    if (!confirm("이 alias 를 삭제할까요?")) return;
    await deleteMut.mutateAsync({ ids: [id] });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function handleToggle(id: number, currentActive: number) {
    await toggleMut.mutateAsync({ id, is_active: currentActive ? 0 : 1 });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">닉네임 alias 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          글 작성 시 자동으로 랜덤 선택되어 표시되는 닉네임 풀입니다. 비활성 alias 는 풀에서 제외됩니다.
        </p>
      </div>

      {/* 대상 user 선택 */}
      <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm">
        <label className="text-slate-500 text-xs font-bold">대상 user_id</label>
        <input
          type="number"
          value={userId}
          onChange={(e) => setUserId(Number(e.target.value) || DEFAULT_USER_ID)}
          className="w-16 text-center font-bold text-slate-800 outline-none tabular-nums"
        />
        <span className="text-xs text-slate-400">(기본: 마스터 13)</span>
      </div>

      {/* 추가 입력 */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-slate-900">alias 추가</h2>
          <span className="text-xs text-slate-400">
            {parsed.length > 0 ? <b className="text-slate-700">{parsed.length}개 인식됨</b> : "쉼표/줄바꿈 구분"}
          </span>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={`쉼표(,) 또는 줄바꿈으로 여러 개 한 번에 추가할 수 있어요.\n예) ${SEED_NICKNAMES.join(", ")}`}
          rows={4}
          className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 resize-y leading-relaxed"
        />
        {parsed.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {parsed.map((n) => (
              <span
                key={n}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100"
              >
                {n}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          ※ 특수문자는 자동 제거됩니다. users 또는 다른 alias 와 중복되는 닉네임은 자동으로 건너뜁니다.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleAdd}
            disabled={parsed.length === 0 || createMut.isPending}
            className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl transition-colors"
          >
            {createMut.isPending ? "추가 중…" : `${parsed.length || ""}개 추가`}
          </button>
        </div>
      </section>

      {/* 목록 */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="font-extrabold text-slate-900">alias 목록</h2>
            <span className="text-xs text-slate-400">
              총 <b className="text-slate-700">{items.length}</b>개 · 활성{" "}
              <b className="text-green-600">{items.filter((a) => a.is_active).length}</b>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              disabled={items.length === 0}
              className="text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 px-3 py-1.5 rounded-lg"
            >
              {selectedIds.size === items.length && items.length > 0 ? "전체 해제" : "전체 선택"}
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || deleteMut.isPending}
              className="text-xs font-bold text-white bg-red-500 hover:bg-red-400 disabled:opacity-40 px-3 py-1.5 rounded-lg"
            >
              선택 삭제{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
          </div>
        </div>

        <div className="p-5">
          {isLoading && (
            <div className="py-12 text-center text-sm text-slate-400">불러오는 중…</div>
          )}
          {isError && (
            <div className="py-12 text-center text-sm text-red-500">alias 목록을 불러오지 못했습니다.</div>
          )}
          {!isLoading && !isError && items.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              아직 등록된 alias 가 없습니다. 위에서 추가해주세요.
            </div>
          )}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {items.map((a) => {
                const selected = selectedIds.has(a.id);
                const active = !!a.is_active;
                return (
                  <div
                    key={a.id}
                    className={`group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-bold border transition-colors cursor-pointer ${
                      selected
                        ? "bg-blue-500 text-white border-blue-500"
                        : active
                        ? "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                        : "bg-slate-100 text-slate-400 border-slate-200 line-through"
                    }`}
                    onClick={() => toggleSelect(a.id)}
                  >
                    <span>{a.nickname}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(a.id, a.is_active);
                      }}
                      title={active ? "비활성화" : "활성화"}
                      className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-[10px] transition-colors ${
                        selected
                          ? "bg-white/20 hover:bg-white/30 text-white"
                          : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                    >
                      {active ? "○" : "●"}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOne(a.id);
                      }}
                      aria-label={`${a.nickname} 삭제`}
                      className={`w-5 h-5 inline-flex items-center justify-center rounded-full text-xs transition-colors ${
                        selected
                          ? "bg-white/20 hover:bg-white/30 text-white"
                          : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                      }`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
