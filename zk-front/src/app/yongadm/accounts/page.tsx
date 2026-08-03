"use client";

import { useEffect, useMemo, useState } from "react";
import { useNworkList, useUpdateNwork } from "@/service/nwork/queries";
import type { NworkRow, SortOrder } from "@/service/nwork/types";

const PAGE_SIZE = 30;
const SORTABLE_TASK_ROLE = "task_role";
const SORTABLE_LAST_LOGIN = "last_login_chk";

// 페이지 기본값
const DEFAULT_USE_STATUS: "" | "0" | "1" = "1";
const DEFAULT_SORT: string | null = SORTABLE_TASK_ROLE;
const DEFAULT_ORDER: SortOrder = "asc";

// ── 셀 컴포넌트 ─────────────────────────────────────────────

function EditableText({
  value,
  onSave,
  disabled,
  className,
  placeholder,
  nullable = false,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  /** 빈 문자열을 null 로 저장할지 (memo 필드용) */
  nullable?: boolean;
}) {
  const [local, setLocal] = useState(value ?? "");
  useEffect(() => setLocal(value ?? ""), [value]);

  const commit = () => {
    const raw = local;
    const original = value ?? "";
    if (raw === original) return;
    if (nullable && raw.trim() === "") {
      onSave(null);
    } else {
      onSave(raw);
    }
  };

  return (
    <input
      value={local}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setLocal(value ?? "");
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={
        className ??
        "w-full text-sm px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      }
    />
  );
}

function EditableInt({
  value,
  onSave,
  disabled,
  className,
  placeholder,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value === null ? "" : String(value));
  useEffect(() => setLocal(value === null ? "" : String(value)), [value]);

  const commit = () => {
    const raw = local.trim();
    const originalRaw = value === null ? "" : String(value);
    if (raw === originalRaw) return;
    if (raw === "") {
      onSave(null);
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n)) {
      // 유효하지 않으면 원래 값으로 되돌림
      setLocal(originalRaw);
      return;
    }
    onSave(n);
  };

  return (
    <input
      value={local}
      disabled={disabled}
      placeholder={placeholder}
      inputMode="numeric"
      pattern="-?[0-9]*"
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          (e.currentTarget as HTMLInputElement).blur();
        } else if (e.key === "Escape") {
          setLocal(value === null ? "" : String(value));
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
      className={
        className ??
        "w-full text-sm px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
      }
    />
  );
}

function UseStatusBadge({
  v,
  onToggle,
  disabled,
}: {
  v: number;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`min-w-[60px] text-center whitespace-nowrap text-[11px] font-bold px-2 py-1 rounded-md transition-colors disabled:opacity-50 ${
        v
          ? "bg-green-50 text-green-600 hover:bg-green-100"
          : "bg-red-50 text-red-600 hover:bg-red-100"
      }`}
      title="클릭하여 사용가능/사용불가 토글"
    >
      {v ? "사용가능" : "사용불가"}
    </button>
  );
}

function TaskRoleSelect({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  // 준비/의심/미사용 → 회색톤, 활성 역할 → 파란톤
  const isReady =
    value.endsWith("준비") || value === "미사용" || value === "최적화의심";
  const cls = isReady
    ? "bg-slate-100 text-slate-600"
    : "bg-blue-50 text-blue-600";
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`text-[11px] font-bold px-2 py-1 rounded-md border-0 outline-none disabled:opacity-50 ${cls}`}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function WorkUsedBadge({
  v,
  onToggle,
  disabled,
}: {
  v: number;
  onToggle: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      title="클릭하여 대기/작업중 토글"
      className={`min-w-[52px] text-center whitespace-nowrap text-[11px] font-bold px-2 py-1 rounded-md transition-colors disabled:opacity-50 ${
        v
          ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      }`}
    >
      {v ? "작업중" : "대기"}
    </button>
  );
}

// ── 행 ──────────────────────────────────────────────────────

function NworkRowView({
  row,
  taskRoles,
}: {
  row: NworkRow;
  taskRoles: string[];
}) {
  const { mutate, isPending } = useUpdateNwork();
  const patch = (p: Parameters<typeof mutate>[0]["patch"]) =>
    mutate({ idx: row.n_idx, patch: p });

  return (
    <tr className="border-b-2 border-slate-200 hover:bg-slate-50/60 align-top">
      <td className="px-3 py-3 text-slate-400 tabular-nums">{row.n_idx}</td>
      <td className="px-3 py-3 text-sm font-bold text-slate-800 whitespace-nowrap">
        {row.n_id}
      </td>
      <td className="px-2 py-2 hidden md:table-cell min-w-[140px]">
        <EditableText
          value={row.n_pwd}
          onSave={(v) => v !== null && patch({ n_pwd: v })}
          disabled={isPending}
          className="w-full font-mono text-xs text-slate-600 px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white outline-none disabled:opacity-50"
        />
      </td>
      <td className="px-3 py-3">
        <UseStatusBadge
          v={row.use_status}
          onToggle={() => patch({ use_status: row.use_status ? 0 : 1 })}
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-3">
        <TaskRoleSelect
          value={row.task_role}
          options={taskRoles}
          onChange={(v) => patch({ task_role: v })}
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-3 hidden md:table-cell">
        <WorkUsedBadge
          v={row.work_used}
          onToggle={() => patch({ work_used: row.work_used ? 0 : 1 })}
          disabled={isPending}
        />
      </td>
      <td className="px-2 py-2 hidden xl:table-cell">
        <EditableInt
          value={row.work_user_agent}
          onSave={(v) => patch({ work_user_agent: v })}
          disabled={isPending}
          placeholder="UA"
          className="w-14 text-xs text-slate-600 tabular-nums text-right px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white outline-none disabled:opacity-50"
        />
      </td>
      <td className="px-2 py-2 hidden xl:table-cell">
        <EditableText
          value={row.work_profile}
          onSave={(v) => patch({ work_profile: v })}
          disabled={isPending}
          placeholder="프로필"
          nullable
          className="w-24 text-xs text-slate-600 px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white outline-none disabled:opacity-50"
        />
      </td>
      <td className="px-2 py-2 min-w-[220px]">
        <div className="space-y-1">
          <EditableText
            value={row.n_memo1}
            onSave={(v) => patch({ n_memo1: v })}
            disabled={isPending}
            placeholder="메모1"
            nullable
            className="w-full text-xs text-slate-600 px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white outline-none disabled:opacity-50"
          />
          <EditableText
            value={row.n_memo2}
            onSave={(v) => patch({ n_memo2: v })}
            disabled={isPending}
            placeholder="메모2"
            nullable
            className="w-full text-xs text-slate-500 px-2 py-1 rounded border border-transparent hover:border-slate-200 focus:border-blue-400 focus:bg-white outline-none disabled:opacity-50"
          />
        </div>
      </td>
      <td className="px-3 py-3 hidden lg:table-cell text-slate-400 tabular-nums text-xs whitespace-nowrap">
        {row.last_login_chk ? row.last_login_chk.slice(0, 16) : "-"}
      </td>
      <td className="px-3 py-3 hidden lg:table-cell text-slate-400 tabular-nums text-xs whitespace-nowrap">
        {row.n_lastwork_at ? row.n_lastwork_at.slice(0, 16) : "-"}
      </td>
    </tr>
  );
}

// ── 페이지네이션 ────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onGo,
}: {
  page: number;
  totalPages: number;
  onGo: (p: number) => void;
}) {
  const WINDOW = 7;
  const half = Math.floor(WINDOW / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(totalPages, start + WINDOW - 1);
  start = Math.max(1, end - WINDOW + 1);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const btn =
    "min-w-[36px] text-sm font-bold px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex items-center justify-center gap-1">
      <button className={btn} disabled={page <= 1} onClick={() => onGo(1)}>
        «
      </button>
      <button className={btn} disabled={page <= 1} onClick={() => onGo(page - 1)}>
        이전
      </button>
      {start > 1 && (
        <span className="text-sm text-slate-400 px-1">…</span>
      )}
      {pages.map((p) => (
        <button
          key={p}
          className={`min-w-[36px] text-sm font-bold px-2 py-1.5 rounded-lg border tabular-nums transition-colors ${
            p === page
              ? "bg-blue-600 text-white border-blue-600"
              : "border-slate-200 hover:bg-slate-50 text-slate-600"
          }`}
          onClick={() => onGo(p)}
        >
          {p}
        </button>
      ))}
      {end < totalPages && (
        <span className="text-sm text-slate-400 px-1">…</span>
      )}
      <button
        className={btn}
        disabled={page >= totalPages}
        onClick={() => onGo(page + 1)}
      >
        다음
      </button>
      <button
        className={btn}
        disabled={page >= totalPages}
        onClick={() => onGo(totalPages)}
      >
        »
      </button>
    </div>
  );
}

// ── 정렬 헤더 ──────────────────────────────────────────────

function SortableTh({
  label,
  sortKey,
  currentSort,
  currentOrder,
  onSort,
  className = "",
}: {
  label: string;
  sortKey: string;
  currentSort: string | null;
  currentOrder: SortOrder;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = currentSort === sortKey;
  const arrow = active ? (currentOrder === "asc" ? "▲" : "▼") : "↕";
  return (
    <th className={`px-3 py-3 font-bold ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-900 ${
          active ? "text-slate-900" : "text-slate-500"
        }`}
      >
        <span>{label}</span>
        <span className="text-[10px] opacity-70">{arrow}</span>
      </button>
    </th>
  );
}

// ── 페이지 ─────────────────────────────────────────────────

export default function YongadmAccountsPage() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [useStatus, setUseStatus] = useState<"" | "0" | "1">(DEFAULT_USE_STATUS);
  const [taskRole, setTaskRole] = useState("");
  const [workUsed, setWorkUsed] = useState<"" | "0" | "1">("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<string | null>(DEFAULT_SORT);
  const [order, setOrder] = useState<SortOrder>(DEFAULT_ORDER);

  const { data, isLoading, isError, isFetching } = useNworkList({
    q,
    use_status: useStatus,
    task_role: taskRole,
    work_used: workUsed,
    page,
    limit: PAGE_SIZE,
    sort: sort ?? undefined,
    order: sort ? order : undefined,
  });

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1),
    [data],
  );

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPage(1);
    setQ(input.trim());
  }

  function handleReset() {
    setInput("");
    setQ("");
    setUseStatus(DEFAULT_USE_STATUS);
    setTaskRole("");
    setWorkUsed("");
    setSort(DEFAULT_SORT);
    setOrder(DEFAULT_ORDER);
    setPage(1);
  }

  // 같은 컬럼 재클릭 → asc/desc 토글 → 다시 누르면 정렬 해제(기본)
  function handleSort(key: string) {
    setPage(1);
    if (sort !== key) {
      setSort(key);
      setOrder("asc");
      return;
    }
    if (order === "asc") {
      setOrder("desc");
      return;
    }
    setSort(null);
    setOrder("desc");
  }

  const isDefaultSort = sort === DEFAULT_SORT && order === DEFAULT_ORDER;
  const isDefaultUseStatus = useStatus === DEFAULT_USE_STATUS;
  const hasFilter =
    q || !isDefaultUseStatus || taskRole || workUsed || !isDefaultSort;
  const taskRoles = data?.filters.task_roles ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">아이디 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            총 {data?.total ?? 0}개
            {isFetching && (
              <span className="ml-2 text-blue-500">불러오는 중…</span>
            )}
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
          <select
            value={useStatus}
            onChange={(e) => {
              setUseStatus(e.target.value as "" | "0" | "1");
              setPage(1);
            }}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-blue-400"
          >
            <option value="">사용상태 전체</option>
            <option value="1">사용가능</option>
            <option value="0">사용불가</option>
          </select>
          <select
            value={taskRole}
            onChange={(e) => {
              setTaskRole(e.target.value);
              setPage(1);
            }}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-blue-400"
          >
            <option value="">역할 전체</option>
            {taskRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={workUsed}
            onChange={(e) => {
              setWorkUsed(e.target.value as "" | "0" | "1");
              setPage(1);
            }}
            className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white outline-none focus:border-blue-400"
          >
            <option value="">작업여부 전체</option>
            <option value="1">작업중</option>
            <option value="0">대기</option>
          </select>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="아이디 · 메모 검색"
            className="w-48 sm:w-56 text-sm border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl transition-colors"
          >
            검색
          </button>
          {hasFilter && (
            <button
              type="button"
              onClick={handleReset}
              className="text-sm font-bold text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              초기화
            </button>
          )}
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-3 py-3 font-bold">idx</th>
                <th className="px-3 py-3 font-bold">아이디</th>
                <th className="px-3 py-3 font-bold hidden md:table-cell">비밀번호</th>
                <th className="px-3 py-3 font-bold">사용</th>
                <SortableTh
                  label="역할"
                  sortKey={SORTABLE_TASK_ROLE}
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                />
                <th className="px-3 py-3 font-bold hidden md:table-cell">작업</th>
                <th className="px-3 py-3 font-bold hidden xl:table-cell text-right">UA</th>
                <th className="px-3 py-3 font-bold hidden xl:table-cell">프로필</th>
                <th className="px-3 py-3 font-bold">메모</th>
                <SortableTh
                  label="최근로그인"
                  sortKey={SORTABLE_LAST_LOGIN}
                  currentSort={sort}
                  currentOrder={order}
                  onSort={handleSort}
                  className="hidden lg:table-cell"
                />
                <th className="px-3 py-3 font-bold hidden lg:table-cell">최근작업</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    불러오는 중…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-red-500">
                    아이디 목록을 불러오지 못했습니다.
                  </td>
                </tr>
              )}
              {!isLoading && !isError && data?.items.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-400">
                    결과가 없습니다.
                  </td>
                </tr>
              )}
              {data?.items.map((row) => (
                <NworkRowView key={row.n_idx} row={row} taskRoles={taskRoles} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {data && totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onGo={setPage} />
      )}
    </div>
  );
}
