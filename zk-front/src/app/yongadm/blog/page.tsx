"use client";

// 블로그 발행 관리 — 디자인 초안.
//   • 상단 : 계정당 발행 개수 · 시작 시각 · 기간 을 정하고 [미리보기] 로 랜덤 시각 분배
//   • 중간 : 사용가능한 "블로그" 계정 목록. 각 계정 옆에 카테고리 체크박스(다중)
//   • 하단 : 계정 × 카테고리 조합으로 뽑힌 예약 목록 (시각/계정/카테고리)
// 파이썬 프로그램은 이 예약(대기열)을 폴링해서 각 예약 시각이 지나면 실제 글 작성/발행을 담당함.
// 지금은 프론트 UI + 시간 분배 로직만 — 백엔드/저장은 미연결.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useNworkList } from "@/service/nwork/queries";
import type { NworkRow } from "@/service/nwork/types";
import { useKeywords } from "@/service/keywords/queries";
import { useGenerateNblogTitles } from "@/service/ai/nblog-title";
import { useBulkSaveNblogJobs } from "@/service/nblog-jobs/mutations";
import {
  useNblogJobs,
  useDeleteNblogJob,
  type NblogJob,
  type NblogJobStatus,
} from "@/service/nblog-jobs/queries";
import { distributeTimes, toLocalInputValue } from "@/lib/blog-schedule";

const BLOG_ROLE = "블로그";

// ── 카테고리 (파이썬 title_generator.py 와 동일) ─────────────
type CategoryKey = "cate1" | "cate2" | "cate3" | "cate4";

const CATEGORIES: {
  key: CategoryKey;
  label: string;
  icon: string;
  auto: boolean; // true=자동(웹검색), false=키워드 기반
}[] = [
  { key: "cate1", label: "연예인", icon: "🎤", auto: true },
  { key: "cate2", label: "음식", icon: "🍽️", auto: true },
  { key: "cate3", label: "부동산", icon: "🏢", auto: false },
  { key: "cate4", label: "모바일", icon: "📱", auto: false },
];

// ── 예약 한 건 (프리뷰용) ────────────────────────────────────
type Reservation = {
  id: string;
  scheduledAt: Date;
  n_idx: number;
  n_id: string;
  category: CategoryKey;
  /** cate1/2 는 null (워커가 제목 생성 후 채움), cate3/4 는 풀에서 뽑은 값 */
  keyword: string | null;
  /** [AI 제목 생성] 눌러야 채워짐. 안 채워도 저장 가능(워커가 실행 시 채움) */
  title?: string;
  titleError?: string;
};

// cate3/4 는 사용자가 넣은 키워드 풀에서 뽑음. cate1/2 는 별도 입력 불필요.
type ManualCategory = "cate3" | "cate4";
type KeywordPools = Record<ManualCategory, string[]>;

// ── 유틸 ─────────────────────────────────────────────────────

function pickCategory(cats: CategoryKey[], seed: number): CategoryKey {
  // 결정적 라운드로빈 (같은 seed 로 항상 같은 결과 → 미리보기 안정성)
  return cats[seed % cats.length];
}

function pickKeyword(
  cat: CategoryKey,
  pools: KeywordPools,
): string | null {
  if (cat === "cate1" || cat === "cate2") return null; // 워커가 나중에 채움
  const pool = pools[cat];
  if (pool.length === 0) return null; // 부족 → 저장 불가로 표시
  return pool[Math.floor(Math.random() * pool.length)];
}

function formatWhen(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${days[d.getDay()]}) ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

// ── 상단: 발행 설정 바 ───────────────────────────────────────

type ConfigProps = {
  perAccount: number;
  setPerAccount: (n: number) => void;
  startAt: string;
  setStartAt: (s: string) => void;
  windowHours: number;
  setWindowHours: (n: number) => void;
  activeAccounts: number;
  totalReservations: number;
  onPreview: () => void;
  hasPreview: boolean;
  onClearPreview: () => void;
};

function ConfigBar(props: ConfigProps) {
  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-extrabold text-slate-900">발행 설정</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            체크된 카테고리 중에서 계정마다 정해진 개수만큼 랜덤 시각으로 뽑아요.
          </p>
        </div>
        <div className="text-xs text-slate-500">
          대상 <b className="text-slate-800">{props.activeAccounts}</b>계정 · 예약{" "}
          <b className="text-blue-600">{props.totalReservations}</b>건 예정
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="text-xs font-bold text-slate-500">계정당 개수</span>
          <input
            type="number"
            min={1}
            max={50}
            value={props.perAccount}
            onChange={(e) =>
              props.setPerAccount(
                Math.max(1, Math.min(50, Number(e.target.value))),
              )
            }
            className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-500">시작 시각</span>
          <input
            type="datetime-local"
            value={props.startAt}
            onChange={(e) => props.setStartAt(e.target.value)}
            className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold text-slate-500">기간(시간)</span>
          <input
            type="number"
            min={1}
            max={720}
            value={props.windowHours}
            onChange={(e) =>
              props.setWindowHours(
                Math.max(1, Math.min(720, Number(e.target.value))),
              )
            }
            className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            onClick={props.onPreview}
            disabled={props.activeAccounts === 0}
            className="flex-1 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors"
          >
            🎲 미리보기
          </button>
          {props.hasPreview && (
            <button
              onClick={props.onClearPreview}
              className="text-sm font-bold text-slate-500 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl"
            >
              초기화
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// ── 중간: 계정 + 카테고리 체크박스 테이블 ────────────────────

type AccountsProps = {
  rows: NworkRow[];
  isLoading: boolean;
  isError: boolean;
  selections: Map<number, Set<CategoryKey>>;
  toggle: (n_idx: number, key: CategoryKey) => void;
  toggleAll: (key: CategoryKey) => void;
  clearRow: (n_idx: number) => void;
};

function AccountsTable(props: AccountsProps) {
  const { rows, selections } = props;

  const columnCounts = CATEGORIES.map(
    (c) => rows.filter((r) => selections.get(r.n_idx)?.has(c.key)).length,
  );

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
            <span>🆔</span> 대상 계정
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            계정마다 다룰 카테고리를 체크하세요. 여러 개 선택 가능.
          </p>
        </div>
        <span className="text-xs text-slate-400">
          사용가능 · 역할=블로그 만 표시
        </span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 font-bold">아이디</th>
              <th className="px-4 py-3 font-bold">비밀번호</th>
              {CATEGORIES.map((c, i) => {
                const total = rows.length;
                const checked = total > 0 && columnCounts[i] === total;
                const some = columnCounts[i] > 0 && !checked;
                return (
                  <th
                    key={c.key}
                    className="px-2 py-3 font-bold text-center align-bottom"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-base leading-none">{c.icon}</span>
                      <span>{c.label}</span>
                      <label
                        className="flex items-center gap-1 text-[10px] font-normal text-slate-500 hover:text-slate-900 cursor-pointer select-none"
                        title="이 열 전체 토글"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          ref={(el) => {
                            if (el) el.indeterminate = some;
                          }}
                          onChange={() => props.toggleAll(c.key)}
                          className="w-3.5 h-3.5 accent-blue-600 cursor-pointer"
                        />
                        <span className="tabular-nums">
                          전체 {columnCounts[i]}/{total}
                        </span>
                      </label>
                    </div>
                  </th>
                );
              })}
              <th className="px-3 py-3 font-bold text-slate-400 w-10" />
            </tr>
          </thead>
          <tbody>
            {props.isLoading && (
              <tr>
                <td
                  colSpan={2 + CATEGORIES.length + 1}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  불러오는 중…
                </td>
              </tr>
            )}
            {props.isError && (
              <tr>
                <td
                  colSpan={2 + CATEGORIES.length + 1}
                  className="px-4 py-12 text-center text-red-500"
                >
                  계정을 불러오지 못했습니다.
                </td>
              </tr>
            )}
            {!props.isLoading && !props.isError && rows.length === 0 && (
              <tr>
                <td
                  colSpan={2 + CATEGORIES.length + 1}
                  className="px-4 py-12 text-center text-slate-400"
                >
                  사용가능한 블로그 계정이 없습니다.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const set = selections.get(r.n_idx) ?? new Set<CategoryKey>();
              const hasAny = set.size > 0;
              return (
                <tr
                  key={r.n_idx}
                  className={`border-b border-slate-100 hover:bg-slate-50/60 ${
                    hasAny ? "bg-blue-50/30" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                    {r.n_id}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-slate-500">
                      {r.n_pwd}
                    </span>
                  </td>
                  {CATEGORIES.map((c) => {
                    const checked = set.has(c.key);
                    return (
                      <td key={c.key} className="px-2 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => props.toggle(r.n_idx, c.key)}
                          className="w-4 h-4 accent-blue-600 cursor-pointer"
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center">
                    {hasAny && (
                      <button
                        onClick={() => props.clearRow(r.n_idx)}
                        className="text-slate-300 hover:text-red-500 text-sm"
                        title="이 계정 선택 초기화"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── 중간2: 카테고리별 키워드 풀 (cate3/4) ───────────────────
// keywords 테이블(어드민 /admin/keywords) 에서 site/phone_model 카테고리를 자동 로드.
// 추가/삭제는 키워드 관리 페이지에서 하고, 여기서는 읽기 전용으로 확인만.

function KeywordPoolSection({
  pools,
  demandByCat,
  loading,
}: {
  pools: KeywordPools;
  demandByCat: Record<ManualCategory, number>;
  loading: boolean;
}) {
  const MANUAL: {
    key: ManualCategory;
    label: string;
    icon: string;
    /** 어드민 /admin/keywords 에 등록할 때의 카테고리 라벨 */
    sourceLabel: string;
  }[] = [
    { key: "cate3", label: "부동산", icon: "🏢", sourceLabel: "현장" },
    { key: "cate4", label: "모바일", icon: "📱", sourceLabel: "기종" },
  ];

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
            <span>🔑</span> 키워드 풀
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            부동산은 <b>현장</b>, 모바일은 <b>기종</b> 키워드를 자동으로 불러와 사용해요.
            연예인 · 음식은 워커가 자동으로 뽑으니 입력 불필요.
          </p>
        </div>
        <Link
          href="/admin/keywords"
          className="text-xs font-bold text-blue-600 hover:text-blue-500 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-lg whitespace-nowrap"
        >
          키워드 관리 →
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MANUAL.map((c) => {
          const pool = pools[c.key];
          const count = pool.length;
          const demand = demandByCat[c.key];
          const short = demand > 0 && count === 0;
          return (
            <div
              key={c.key}
              className={`rounded-xl border p-3 ${
                short ? "border-red-300 bg-red-50/40" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                  <span className="text-[10px] font-normal text-slate-400 uppercase">
                    {c.key} · {c.sourceLabel}
                  </span>
                </span>
                <span
                  className={`text-[11px] font-bold tabular-nums ${
                    short ? "text-red-500" : "text-slate-500"
                  }`}
                >
                  {count}개
                  {demand > 0 && (
                    <span className="text-slate-400 font-normal">
                      {" "}
                      / 필요 {demand}건
                    </span>
                  )}
                </span>
              </div>

              {loading ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  불러오는 중…
                </div>
              ) : count === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  등록된 키워드가 없습니다.{" "}
                  <Link
                    href="/admin/keywords"
                    className="text-blue-600 hover:underline"
                  >
                    &quot;{c.sourceLabel}&quot; 에 추가
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {pool.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── 하단: 예약 미리보기 ─────────────────────────────────────

function PreviewSection({
  reservations,
  onRemove,
  onSave,
  isSaving,
  onGenerateTitles,
  isGenerating,
  generateProgress,
}: {
  reservations: Reservation[];
  onRemove: (id: string) => void;
  onSave: () => void;
  isSaving: boolean;
  onGenerateTitles: () => void;
  isGenerating: boolean;
  generateProgress: { done: number; total: number } | null;
}) {
  const missingKeyword = reservations.filter(
    (r) => (r.category === "cate3" || r.category === "cate4") && !r.keyword,
  ).length;
  const canSave = reservations.length > 0 && missingKeyword === 0;

  // 제목 생성 대상 = 키워드가 OK 인 것 중 아직 title 이 없는 것
  const pendingTitles = reservations.filter((r) => {
    const needsKw = r.category === "cate3" || r.category === "cate4";
    const kwReady = !needsKw || !!r.keyword;
    return kwReady && !r.title;
  }).length;

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
            <span>🗓️</span> 예약 미리보기
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            [AI 제목 생성] 으로 미리 뽑아 두거나, 비워두면 파이썬 워커가 실행 시각에 생성해요.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {missingKeyword > 0 && (
            <span className="text-xs font-bold text-red-500">
              키워드 없음 {missingKeyword}건
            </span>
          )}
          <button
            onClick={onGenerateTitles}
            disabled={isGenerating || pendingTitles === 0}
            title={
              pendingTitles === 0
                ? "생성할 제목이 없습니다"
                : `${pendingTitles}건에 대해 AI 로 제목 생성`
            }
            className="text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                {generateProgress
                  ? `${generateProgress.done}/${generateProgress.total}`
                  : "생성 중…"}
              </>
            ) : (
              <>✨ AI 제목 생성 ({pendingTitles})</>
            )}
          </button>
          <button
            onClick={onSave}
            disabled={!canSave || isSaving}
            title={
              missingKeyword > 0
                ? "cate3/cate4 는 키워드 풀에서 값이 뽑혀야 저장 가능"
                : `${reservations.length}건을 발행 예약으로 저장`
            }
            className="text-sm font-bold text-white bg-slate-900 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2 rounded-xl flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="inline-block w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                저장 중…
              </>
            ) : (
              <>{reservations.length}건 저장 → 발행 예약</>
            )}
          </button>
        </div>
      </header>

      {reservations.length === 0 ? (
        <div className="py-14 text-center text-sm text-slate-400">
          위에서 카테고리를 체크하고 [미리보기] 를 눌러보세요.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-bold w-12">#</th>
                <th className="px-4 py-3 font-bold">발행 시각</th>
                <th className="px-4 py-3 font-bold">계정</th>
                <th className="px-4 py-3 font-bold">카테고리</th>
                <th className="px-4 py-3 font-bold">키워드</th>
                <th className="px-4 py-3 font-bold">제목</th>
                <th className="px-4 py-3 font-bold w-12" />
              </tr>
            </thead>
            <tbody>
              {reservations.map((r, i) => {
                const cat = CATEGORIES.find((c) => c.key === r.category)!;
                const needsKw = r.category === "cate3" || r.category === "cate4";
                return (
                  <tr
                    key={r.id}
                    className="border-b border-slate-100 hover:bg-slate-50/60 align-top"
                  >
                    <td className="px-4 py-2 text-slate-400 tabular-nums">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2 font-bold text-blue-600 tabular-nums whitespace-nowrap">
                      {formatWhen(r.scheduledAt)}
                    </td>
                    <td className="px-4 py-2 font-bold text-slate-800">
                      {r.n_id}
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                        <span>{cat.icon}</span>
                        {cat.label}
                        <span className="text-[10px] text-slate-400 ml-1">
                          {cat.auto ? "자동" : "키워드"}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      {r.keyword ? (
                        <span className="text-slate-700">{r.keyword}</span>
                      ) : needsKw ? (
                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md">
                          키워드 필요
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          생성 시 자동 추출
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm min-w-[240px]">
                      {r.title ? (
                        <span className="text-slate-800">{r.title}</span>
                      ) : r.titleError ? (
                        <span
                          className="text-xs font-bold text-red-500"
                          title={r.titleError}
                        >
                          실패: {r.titleError.slice(0, 40)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          미생성 (워커가 실행 시 채움)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => onRemove(r.id)}
                        className="text-slate-300 hover:text-red-500"
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── 하단2: 저장된 예약 목록 (nblog_jobs) ────────────────────

const STATUS_META: Record<
  NblogJobStatus,
  { label: string; cls: string; dot: string }
> = {
  PENDING: { label: "대기", cls: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  PROCESSING: {
    label: "진행중",
    cls: "bg-blue-50 text-blue-600",
    dot: "bg-blue-500 animate-pulse",
  },
  DONE: { label: "완료", cls: "bg-green-50 text-green-600", dot: "bg-green-500" },
  FAILED: { label: "실패", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
};

function formatScheduled(dt: string): string {
  // 'YYYY-MM-DD HH:MM:SS' → 'MM/DD(요일) HH:MM'
  const d = new Date(dt.replace(" ", "T"));
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${days[d.getDay()]}) ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function ReservationsListSection() {
  const [status, setStatus] = useState<NblogJobStatus | undefined>(undefined);
  const { data, isPending, isError, isFetching, refetch } = useNblogJobs({
    status,
    limit: 200,
  });
  const deleteMut = useDeleteNblogJob();

  const jobs = data?.items ?? [];
  const counts = data?.counts ?? {
    PENDING: 0,
    PROCESSING: 0,
    DONE: 0,
    FAILED: 0,
  };

  async function handleRemove(job: NblogJob) {
    const label =
      job.title || `[${job.category}] ${job.keyword ?? "(무제)"}`;
    if (!confirm(`이 예약을 삭제할까요?\n\n${label}`)) return;
    try {
      await deleteMut.mutateAsync(job.id);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  const filterBtn = (v: NblogJobStatus | undefined, label: string, n: number) => {
    const active = status === v;
    return (
      <button
        key={label}
        onClick={() => setStatus(v)}
        className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
          active
            ? "bg-slate-900 text-white"
            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
        }`}
      >
        {label} <span className="tabular-nums">{n}</span>
      </button>
    );
  };

  return (
    <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <header className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-slate-900 flex items-center gap-2">
            <span>📋</span> 저장된 예약 목록
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            파이썬 워커가 이 큐를 폴링해서 발행합니다. 상태 확인은 🔄 로 갱신.
            {isFetching && !isPending && (
              <span className="ml-2 text-blue-500">갱신 중…</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {filterBtn(undefined, "전체", jobs.length)}
          {filterBtn("PENDING", "대기", counts.PENDING)}
          {filterBtn("PROCESSING", "진행중", counts.PROCESSING)}
          {filterBtn("DONE", "완료", counts.DONE)}
          {filterBtn("FAILED", "실패", counts.FAILED)}
          <button
            onClick={() => refetch()}
            className="text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg"
            title="새로고침"
          >
            🔄
          </button>
        </div>
      </header>

      {isPending ? (
        <div className="py-14 text-center text-sm text-slate-400">불러오는 중…</div>
      ) : isError ? (
        <div className="py-14 text-center text-sm text-red-500">
          목록을 불러오지 못했습니다.
        </div>
      ) : jobs.length === 0 ? (
        <div className="py-14 text-center text-sm text-slate-400">
          {status ? `${STATUS_META[status].label} 상태의 예약이 없습니다.` : "저장된 예약이 없습니다."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-bold">발행 시각</th>
                <th className="px-4 py-3 font-bold">계정</th>
                <th className="px-4 py-3 font-bold">카테고리</th>
                <th className="px-4 py-3 font-bold">키워드</th>
                <th className="px-4 py-3 font-bold">제목</th>
                <th className="px-4 py-3 font-bold">상태</th>
                <th className="px-4 py-3 font-bold w-12" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const cat = CATEGORIES.find((c) => c.key === job.category);
                const meta = STATUS_META[job.status];
                return (
                  <tr
                    key={job.id}
                    className="border-b border-slate-100 hover:bg-slate-50/60 align-top"
                  >
                    <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap tabular-nums">
                      {formatScheduled(job.scheduled_at)}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                      {job.n_id}
                    </td>
                    <td className="px-4 py-3">
                      {cat && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                          <span>{cat.icon}</span>
                          {cat.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {job.keyword || (
                        <span className="text-xs text-slate-400">
                          {job.category === "cate1" || job.category === "cate2"
                            ? "워커가 추출"
                            : "-"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800 min-w-[240px]">
                      {job.status === "DONE" && job.result_url ? (
                        <a
                          href={job.result_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {job.title || "(제목없음)"}
                        </a>
                      ) : job.title ? (
                        job.title
                      ) : (
                        <span className="text-xs text-slate-400">
                          {job.status === "PENDING" ? "워커가 실행 시 생성" : "-"}
                        </span>
                      )}
                      {job.status === "FAILED" && job.error && (
                        <div className="mt-0.5 text-[11px] text-red-500 line-clamp-2">
                          {job.error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md ${meta.cls}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRemove(job)}
                        disabled={
                          deleteMut.isPending || job.status === "PROCESSING"
                        }
                        title={
                          job.status === "PROCESSING"
                            ? "진행중인 예약은 삭제할 수 없습니다"
                            : "삭제"
                        }
                        className="text-slate-300 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ── 페이지 ───────────────────────────────────────────────────

export default function YongadmBlogPage() {
  const { data, isLoading, isError, isFetching } = useNworkList({
    task_role: BLOG_ROLE,
    use_status: "1",
    page: 1,
    limit: 200,
    sort: "n_id",
    order: "asc",
  });
  const rows = useMemo(() => data?.items ?? [], [data]);

  // 계정별 카테고리 선택 — 세션 상태 (추후 nwork 컬럼으로 영속화 가능)
  const [selections, setSelections] = useState<Map<number, Set<CategoryKey>>>(
    new Map(),
  );

  function toggle(n_idx: number, key: CategoryKey) {
    setSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(n_idx) ?? []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      if (set.size === 0) next.delete(n_idx);
      else next.set(n_idx, set);
      return next;
    });
  }

  function toggleAll(key: CategoryKey) {
    setSelections((prev) => {
      const allChecked = rows.every((r) => prev.get(r.n_idx)?.has(key));
      const next = new Map(prev);
      for (const r of rows) {
        const set = new Set(next.get(r.n_idx) ?? []);
        if (allChecked) set.delete(key);
        else set.add(key);
        if (set.size === 0) next.delete(r.n_idx);
        else next.set(r.n_idx, set);
      }
      return next;
    });
  }

  function clearRow(n_idx: number) {
    setSelections((prev) => {
      const next = new Map(prev);
      next.delete(n_idx);
      return next;
    });
  }

  // 설정
  const [perAccount, setPerAccount] = useState(3);
  const [startAt, setStartAt] = useState("");
  const [windowHours, setWindowHours] = useState(24);

  useEffect(() => {
    setStartAt(toLocalInputValue(new Date()));
  }, []);

  // cate3/4 키워드 풀 — 어드민 /admin/keywords 에서 자동 로드
  //   cate3(부동산) ← site(현장)
  //   cate4(모바일) ← phone_model(기종)
  const siteKw = useKeywords("site");
  const phoneKw = useKeywords("phone_model");
  const parsedPools = useMemo<KeywordPools>(
    () => ({
      cate3: (siteKw.data?.items ?? []).map((k) => k.name),
      cate4: (phoneKw.data?.items ?? []).map((k) => k.name),
    }),
    [siteKw.data, phoneKw.data],
  );

  // 미리보기 예약 목록
  const [reservations, setReservations] = useState<Reservation[]>([]);

  const activeAccounts = rows.filter((r) => selections.has(r.n_idx));
  const totalReservations = activeAccounts.length * perAccount;

  // 카테고리별 "필요 건수" — 상단 키워드 풀 UI 에 표시해 부족 여부 알림
  // (라운드로빈으로 뽑는 pickCategory 특성상 정확한 수 계산)
  const demandByCat = useMemo(() => {
    const d: Record<ManualCategory, number> = { cate3: 0, cate4: 0 };
    for (const acc of activeAccounts) {
      const cats = Array.from(selections.get(acc.n_idx) ?? []);
      for (let i = 0; i < perAccount; i++) {
        const c = pickCategory(cats, i);
        if (c === "cate3" || c === "cate4") d[c]++;
      }
    }
    return d;
  }, [activeAccounts, selections, perAccount]);

  function handlePreview() {
    if (!startAt || activeAccounts.length === 0) return;

    // 모든 계정 × perAccount 만큼 시간을 한번에 뽑음.
    // 새벽 발행 방지 — 오전 8시 ~ 오후 10시 활동 시간대에만 분배.
    const times = distributeTimes(totalReservations, {
      startAt: new Date(startAt),
      windowHours,
      mode: "daytime",
      dayStart: 8,
      dayEnd: 22,
    });

    // 계정별로 자기 몫만큼 시간을 셔플로 나눠 갖기
    // (같은 계정의 여러 발행이 시간 순서로 몰리지 않도록 전역 셔플)
    const shuffledTimes = [...times].sort(() => Math.random() - 0.5);

    const list: Reservation[] = [];
    let timeCursor = 0;
    activeAccounts.forEach((account) => {
      const cats = Array.from(selections.get(account.n_idx) ?? []);
      for (let i = 0; i < perAccount; i++) {
        const time = shuffledTimes[timeCursor++];
        const category = pickCategory(cats, i);
        list.push({
          id: `${account.n_idx}-${i}-${time.getTime()}`,
          scheduledAt: time,
          n_idx: account.n_idx,
          n_id: account.n_id,
          category,
          keyword: pickKeyword(category, parsedPools),
        });
      }
    });

    // 시간순 정렬
    list.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
    setReservations(list);
  }

  // 저장 — /api/nblog-jobs/bulk 로 예약 등록. 파이썬 워커가 이 큐를 폴링해서 발행.
  const saveMut = useBulkSaveNblogJobs();

  async function handleSave() {
    if (reservations.length === 0) return;

    // cate3/4 는 keyword 필수 — 미리보기에서 이미 막지만 방어적으로 재확인
    const bad = reservations.filter(
      (r) => (r.category === "cate3" || r.category === "cate4") && !r.keyword,
    );
    if (bad.length > 0) {
      alert(`키워드가 없는 예약이 ${bad.length}건 있습니다. cate3/cate4 는 키워드가 필수입니다.`);
      return;
    }

    try {
      const result = await saveMut.mutateAsync({
        items: reservations.map((r) => ({
          n_idx: r.n_idx,
          category: r.category,
          keyword: r.keyword ?? undefined,
          title: r.title,
          scheduled_at: r.scheduledAt.toISOString(),
        })),
      });
      alert(`${result.saved}건 발행 예약 완료`);
      setReservations([]);
      // 선택 상태는 유지 — 다음 배치에서 그대로 재사용할 수 있게
    } catch (err) {
      alert((err as Error).message ?? "저장에 실패했습니다.");
    }
  }

  // AI 제목 생성 — 파이썬 title_generator 를 백엔드로 이식한 /api/ai/nblog-titles 호출
  const titleMut = useGenerateNblogTitles();
  const [titleProgress, setTitleProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  async function handleGenerateTitles() {
    // 대상: 아직 title 없고 (cate3/4 면) keyword 도 준비된 것만
    const targets = reservations.filter((r) => {
      const needsKw = r.category === "cate3" || r.category === "cate4";
      const kwReady = !needsKw || !!r.keyword;
      return kwReady && !r.title;
    });
    if (targets.length === 0) return;

    // 백엔드 상한(50) 을 넘지 않게 25건씩 청크로 진행 — 실패해도 부분 반영
    const CHUNK = 25;
    setTitleProgress({ done: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i += CHUNK) {
        const slice = targets.slice(i, i + CHUNK);
        const resp = await titleMut.mutateAsync(
          slice.map((r) => ({
            category: r.category,
            keyword: r.keyword ?? undefined,
          })),
        );
        // 응답 순서 = 요청 순서 → id 매칭으로 반영
        setReservations((prev) => {
          const byId = new Map(prev.map((r) => [r.id, r]));
          slice.forEach((req, k) => {
            const result = resp.items[k];
            const cur = byId.get(req.id);
            if (!cur) return;
            if (result.ok) {
              byId.set(req.id, {
                ...cur,
                title: result.title,
                keyword: cur.keyword ?? result.keyword,
                titleError: undefined,
              });
            } else {
              byId.set(req.id, { ...cur, titleError: result.error });
            }
          });
          return Array.from(byId.values());
        });
        setTitleProgress({ done: Math.min(i + CHUNK, targets.length), total: targets.length });
      }
    } finally {
      setTitleProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold text-slate-900">
          블로그 발행 관리
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          계정 × 카테고리로 발행 예약을 만들면 파이썬 워커가 예약 시각에
          맞춰 글을 씁니다.
          {isFetching && (
            <span className="ml-2 text-blue-500">불러오는 중…</span>
          )}
        </p>
      </header>

      <ConfigBar
        perAccount={perAccount}
        setPerAccount={setPerAccount}
        startAt={startAt}
        setStartAt={setStartAt}
        windowHours={windowHours}
        setWindowHours={setWindowHours}
        activeAccounts={activeAccounts.length}
        totalReservations={totalReservations}
        onPreview={handlePreview}
        hasPreview={reservations.length > 0}
        onClearPreview={() => setReservations([])}
      />

      <AccountsTable
        rows={rows}
        isLoading={isLoading}
        isError={isError}
        selections={selections}
        toggle={toggle}
        toggleAll={toggleAll}
        clearRow={clearRow}
      />

      <KeywordPoolSection
        pools={parsedPools}
        demandByCat={demandByCat}
        loading={siteKw.isLoading || phoneKw.isLoading}
      />

      <PreviewSection
        reservations={reservations}
        onRemove={(id) =>
          setReservations((prev) => prev.filter((r) => r.id !== id))
        }
        onSave={handleSave}
        isSaving={saveMut.isPending}
        onGenerateTitles={handleGenerateTitles}
        isGenerating={titleMut.isPending}
        generateProgress={titleProgress}
      />

      <ReservationsListSection />
    </div>
  );
}
