"use client";

import { useEffect, useState } from "react";
import { useGenerateBlogTitles } from "@/service/ai/mutations";

type Props = {
  open: boolean;
  onClose: () => void;
  /** 생성할 제목 개수 범위 */
  min: number;
  max: number;
  /** "선택한 제목을 새 예약 입력란에 추가" 시 호출 */
  onAppend: (titles: string[]) => void;
};

export default function AITitleModal({ open, onClose, min, max, onAppend }: Props) {
  const { mutate, data, isPending, isError, error, reset } = useGenerateBlogTitles();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 모달을 열 때마다 자동으로 첫 호출 — 그 시점의 min/max 사용
  useEffect(() => {
    if (open) {
      reset();
      setSelected(new Set());
      mutate({ min, max });
    }
    // open 트리거 시점의 min/max 만 사용 (입력 변경 때마다 자동 재생성 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 응답이 새로 오면 전체 선택 상태로 (사용자가 부분 해제하기 쉽게)
  useEffect(() => {
    if (data?.titles) setSelected(new Set(data.titles));
  }, [data]);

  if (!open) return null;

  const titles = data?.titles ?? [];

  function toggle(title: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === titles.length) setSelected(new Set());
    else setSelected(new Set(titles));
  }

  function handleAppend() {
    const picked = titles.filter((t) => selected.has(t));
    if (picked.length === 0) return;
    onAppend(picked);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
              <span>✨</span> AI 제목 생성
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              지역 · 기종 키워드 기반으로 {min}~{max}개의 블로그 제목을 만들어요.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl px-2"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-5">
          {isPending && (
            <div className="py-16 text-center">
              <div className="inline-block w-8 h-8 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              <p className="mt-3 text-sm text-slate-500">제목 생성 중…</p>
            </div>
          )}

          {isError && (
            <div className="py-16 text-center text-sm text-red-500">
              {(error as Error)?.message ?? "생성에 실패했습니다."}
              <div className="mt-3">
                <button
                  onClick={() => mutate({ min, max })}
                  className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-700 px-3 py-2 rounded-lg"
                >
                  다시 시도
                </button>
              </div>
            </div>
          )}

          {!isPending && !isError && titles.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-slate-500">
                  총 <b className="text-slate-800">{titles.length}</b>개 ·{" "}
                  선택 <b className="text-blue-600">{selected.size}</b>개
                </div>
                <button
                  onClick={toggleAll}
                  className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg"
                >
                  {selected.size === titles.length ? "전체 해제" : "전체 선택"}
                </button>
              </div>
              <ul className="space-y-1.5">
                {titles.map((line) => {
                  const checked = selected.has(line);
                  // AI 출력은 "제목|지역성지,기종" 형태 — 표시는 제목만, 키워드는 작게
                  const [titlePart, keywordPart = ""] = line.split("|");
                  return (
                    <li key={line}>
                      <label
                        className={`flex items-start gap-3 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                          checked
                            ? "border-blue-300 bg-blue-50/60"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(line)}
                          className="w-4 h-4 accent-blue-600 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-slate-800 truncate">{titlePart.trim()}</div>
                          {keywordPart && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
                              {keywordPart.split(",").map((k, i) => {
                                const kw = k.trim();
                                if (!kw) return null;
                                return (
                                  <span
                                    key={`${kw}-${i}`}
                                    className="text-[11px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md"
                                  >
                                    {kw}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={() => mutate({ min, max })}
            disabled={isPending}
            className="text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 disabled:opacity-40 px-4 py-2 rounded-xl"
          >
            🎲 다시 생성
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="text-sm font-bold text-slate-500 hover:text-slate-800 px-4 py-2 rounded-xl"
          >
            취소
          </button>
          <button
            onClick={handleAppend}
            disabled={selected.size === 0 || isPending}
            className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl transition-colors"
          >
            새 예약에 추가{selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
