"use client";

import { useMemo, useState } from "react";
import { useKeywords } from "@/service/keywords/queries";
import {
  useBulkCreateKeywords,
  useBulkDeleteKeywords,
} from "@/service/keywords/mutations";
import {
  KEYWORD_CATEGORY_LABEL,
  type Keyword,
  type KeywordCategory,
} from "@/service/keywords/types";

const CATEGORIES: KeywordCategory[] = ["region", "phone_model"];

const PLACEHOLDER: Record<KeywordCategory, string> = {
  region:
    "쉼표(,) 또는 줄바꿈으로 여러 개 한 번에 추가할 수 있어요.\n예) 강남, 강남구, 서초, 서초구, 송파, 잠실, 사당",
  phone_model:
    "쉼표(,) 또는 줄바꿈으로 여러 개 한 번에 추가할 수 있어요.\n예) 갤럭시 S26, 아이폰 17 프로, 갤럭시 Z플립7, 아이폰 17",
};

// 한글/영문/숫자/공백만 허용, 나머지 특수문자 제거. 공백 중복 정리.
function sanitizeName(raw: string): string {
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
        .map((s) => sanitizeName(s))
        .filter((s) => s.length > 0),
    ),
  );
}

export default function KeywordsPage() {
  const [category, setCategory] = useState<KeywordCategory>("region");
  const [raw, setRaw] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading, isError } = useKeywords(category);
  const createMut = useBulkCreateKeywords();
  const deleteMut = useBulkDeleteKeywords();

  const items: Keyword[] = useMemo(() => data?.items ?? [], [data]);
  const parsed = useMemo(() => splitNames(raw), [raw]);

  function switchCategory(next: KeywordCategory) {
    if (next === category) return;
    setCategory(next);
    setSelectedIds(new Set());
    setRaw("");
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((k) => k.id)));
    }
  }

  async function handleAdd() {
    if (parsed.length === 0) return;
    await createMut.mutateAsync({ category, names: parsed });
    setRaw("");
  }

  async function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!confirm(`선택한 ${selectedIds.size}개 키워드를 삭제할까요?`)) return;
    await deleteMut.mutateAsync({ ids: Array.from(selectedIds) });
    setSelectedIds(new Set());
  }

  async function handleDeleteOne(id: number) {
    if (!confirm("이 키워드를 삭제할까요?")) return;
    await deleteMut.mutateAsync({ ids: [id] });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">키워드 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          블로그 글 작성에 사용되는 지역 · 휴대폰 기종 키워드를 관리합니다.
        </p>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2">
        {CATEGORIES.map((c) => {
          const active = c === category;
          return (
            <button
              key={c}
              onClick={() => switchCategory(c)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {KEYWORD_CATEGORY_LABEL[c]}
            </button>
          );
        })}
      </div>

      {/* 추가 입력 */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-slate-900">
            {KEYWORD_CATEGORY_LABEL[category]} 키워드 추가
          </h2>
          <span className="text-xs text-slate-400">
            {parsed.length > 0 && <b className="text-slate-700">{parsed.length}개</b>}
            {parsed.length > 0 ? " 인식됨" : "쉼표/줄바꿈 구분"}
          </span>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={PLACEHOLDER[category]}
          rows={4}
          className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 resize-y leading-relaxed"
        />
        {parsed.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {parsed.map((name) => (
              <span
                key={name}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100"
              >
                {name}
              </span>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-400">
          ※ 특수문자는 자동으로 제거됩니다. 한글 · 영문 · 숫자 · 공백만 저장돼요.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleAdd}
            disabled={parsed.length === 0 || createMut.isPending}
            className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl transition-colors"
          >
            {createMut.isPending ? "추가 중…" : `${parsed.length || ""}개 추가`}
          </button>
          {createMut.isError && (
            <span className="text-xs text-red-500">
              추가에 실패했습니다. 잠시 후 다시 시도해주세요.
            </span>
          )}
        </div>
      </section>

      {/* 목록 + 일괄 삭제 */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h2 className="font-extrabold text-slate-900">
              {KEYWORD_CATEGORY_LABEL[category]} 목록
            </h2>
            <span className="text-xs text-slate-400">
              총 <b className="text-slate-700">{items.length}</b>개
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              disabled={items.length === 0}
              className="text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors"
            >
              {selectedIds.size === items.length && items.length > 0
                ? "전체 해제"
                : "전체 선택"}
            </button>
            <button
              onClick={handleDeleteSelected}
              disabled={selectedIds.size === 0 || deleteMut.isPending}
              className="text-xs font-bold text-white bg-red-500 hover:bg-red-400 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-1.5 rounded-lg transition-colors"
            >
              {deleteMut.isPending
                ? "삭제 중…"
                : `선택 삭제${
                    selectedIds.size > 0 ? ` (${selectedIds.size})` : ""
                  }`}
            </button>
          </div>
        </div>

        <div className="p-5">
          {isLoading && (
            <div className="py-12 text-center text-sm text-slate-400">
              불러오는 중…
            </div>
          )}
          {isError && (
            <div className="py-12 text-center text-sm text-red-500">
              키워드 목록을 불러오지 못했습니다.
            </div>
          )}
          {!isLoading && !isError && items.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              아직 등록된 키워드가 없습니다.
            </div>
          )}
          {items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {items.map((k) => {
                const selected = selectedIds.has(k.id);
                return (
                  <div
                    key={k.id}
                    className={`group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-bold border transition-colors cursor-pointer ${
                      selected
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300"
                    }`}
                    onClick={() => toggleSelect(k.id)}
                  >
                    <span>{k.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteOne(k.id);
                      }}
                      aria-label={`${k.name} 삭제`}
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
