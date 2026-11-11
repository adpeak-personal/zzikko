'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Copy, Eye, EyeOff, ListPlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { ApiError, apiFetch, query } from '@/lib/api';
import { Pagination } from '@/components/board/Pagination';
import { cn, formatNumber } from '@/lib/utils';
import type { NworkAccount, NworkSummary, Paged } from '@/lib/types';

/** 화면 필터 — URL 쿼리와 같은 모양 ('' 이면 전체) */
export interface NworkFilters {
  q: string;
  role: string;
  usable: '' | '1' | '0';
  working: '' | '1' | '0';
}

const BASE = '/admin/nwork';

/** 지금 쓰는 용도 — 목록에 없는 값도 직접 입력할 수 있다 */
const KNOWN_ROLES = ['미사용', '블로그준비', '블로그', '밴드'];

const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

const inputClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-zz-400';

const hrefFor = (filters: NworkFilters, page = 1) => BASE + query({ ...filters, page: page > 1 ? page : undefined });

/** 'YYYY-MM-DD HH:MM:SS' → 'YY.MM.DD HH:MM' */
const shortDate = (value: string | null) => (value ? `${value.slice(2, 4)}.${value.slice(5, 7)}.${value.slice(8, 10)} ${value.slice(11, 16)}` : '-');

function RoleBadge({ role }: { role: string }) {
  const tone =
    role === '블로그'
      ? 'bg-zz-50 text-zz-700'
      : role === '블로그준비'
        ? 'bg-amber-50 text-amber-800'
        : role === '밴드'
          ? 'bg-sky-50 text-sky-700'
          : 'bg-gray-100 text-gray-500';
  return <span className={cn('whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium', tone)}>{role}</span>;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
    >
      {done ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
    </button>
  );
}

/** 비밀번호는 목록에 안 실려 온다 — 누를 때만 받아서 보여준다 */
function PasswordCell({ id }: { id: number }) {
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    if (password !== null) return setPassword(null);
    setLoading(true);
    try {
      const res = await apiFetch<{ password: string }>(`${BASE}/${id}/password`);
      setPassword(res.password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span className="flex items-center gap-0.5">
      <span className="font-mono text-xs text-gray-700">{password ?? '••••••'}</span>
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        aria-label={password === null ? '비밀번호 보기' : '비밀번호 숨기기'}
        className="rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
      >
        {password === null ? <Eye size={13} /> : <EyeOff size={13} />}
      </button>
      {password !== null && <CopyButton text={password} label="비밀번호 복사" />}
    </span>
  );
}

function RoleInput({ value, onChange, roles }: { value: string; onChange: (role: string) => void; roles: string[] }) {
  // 한 화면에 여러 개가 뜨므로 datalist id 가 겹치지 않게
  const listId = useId();
  return (
    <>
      <input value={value} onChange={(e) => onChange(e.target.value)} list={listId} maxLength={20} className={inputClass} />
      <datalist id={listId}>
        {roles.map((role) => (
          <option key={role} value={role} />
        ))}
      </datalist>
    </>
  );
}

/* ── 한 계정 추가 · 수정 ─────────────────────────── */

type Draft = Pick<NworkAccount, 'id' | 'loginId' | 'memo1' | 'memo2' | 'memo3' | 'usable' | 'role' | 'working'> & { password: string };

const emptyDraft = (): Draft => ({
  id: 0,
  loginId: '',
  password: '',
  memo1: '',
  memo2: '',
  memo3: '',
  usable: true,
  role: '미사용',
  working: false,
});

function AccountForm({ draft, roles, onDone }: { draft: Draft; roles: string[]; onDone: () => void }) {
  const [form, setForm] = useState(draft);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isNew = !form.id;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.loginId.trim()) return setError('아이디를 입력해 주세요.');
    if (isNew && !form.password) return setError('비밀번호를 입력해 주세요.');

    setSaving(true);
    setError(null);
    // 수정할 때 비밀번호 칸이 비어 있으면 보내지 않는다 — 기존 비밀번호 유지
    const { id, password, ...rest } = form;
    const body = { ...rest, loginId: rest.loginId.trim(), role: rest.role.trim() || '미사용', ...(password ? { password } : {}) };
    try {
      await apiFetch(isNew ? BASE : `${BASE}/${id}`, { method: isNew ? 'POST' : 'PATCH', body: JSON.stringify(body) });
      onDone();
    } catch (err) {
      setError(message(err, '저장하지 못했습니다.'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs font-medium text-gray-600">
          아이디
          <input value={form.loginId} onChange={(e) => set('loginId', e.target.value)} maxLength={100} className={cn(inputClass, 'mt-1')} />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          비밀번호 {!isNew && <span className="font-normal text-gray-400">(바꿀 때만 입력)</span>}
          <input
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
            maxLength={100}
            autoComplete="off"
            className={cn(inputClass, 'mt-1 font-mono')}
          />
        </label>
        <label className="block text-xs font-medium text-gray-600">
          용도
          <div className="mt-1">
            <RoleInput value={form.role} onChange={(role) => set('role', role)} roles={roles} />
          </div>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(['memo1', 'memo2', 'memo3'] as const).map((key, i) => (
          <label key={key} className="block text-xs font-medium text-gray-600">
            메모{i + 1}
            <span className="font-normal text-gray-400">{i === 0 ? ' — 이름 · 생년 등' : i === 1 ? ' — 최근 작업 기록' : ''}</span>
            <input value={form[key]} onChange={(e) => set(key, e.target.value)} maxLength={255} className={cn(inputClass, 'mt-1')} />
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.usable} onChange={(e) => set('usable', e.target.checked)} className="accent-zz-600" />
          사용 가능 (로그인이 막힌 계정은 끈다)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.working} onChange={(e) => set('working', e.target.checked)} className="accent-zz-600" />
          작업 중 (프로그램이 쓰는 중)
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
        <button type="button" onClick={onDone} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">
          취소
        </button>
        <button type="submit" disabled={saving} className="rounded-lg bg-zz-600 px-5 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-60">
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}

/* ── 여러 줄 붙여넣기로 추가 ─────────────────────── */

function ImportForm({ roles, onDone }: { roles: string[]; onDone: () => void }) {
  const [text, setText] = useState('');
  const [role, setRole] = useState('미사용');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const lines = text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#')).length;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ added: number; skipped: string[] }>(`${BASE}/import`, {
        method: 'POST',
        body: JSON.stringify({ text, role: role.trim() || '미사용' }),
      });
      setResult(
        `${res.added}개 추가` +
          (res.skipped.length ? ` · 이미 있는 아이디 ${res.skipped.length}개는 건너뜀 (${res.skipped.slice(0, 5).join(', ')}${res.skipped.length > 5 ? ' …' : ''})` : ''),
      );
      setText('');
      onDone();
    } catch (err) {
      setError(message(err, '추가하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4">
      <label className="block text-xs font-medium text-gray-600">
        한 줄에 하나씩 <code className="rounded bg-white px-1">아이디|비밀번호|메모</code> (메모는 없어도 됩니다. 이미 있는 아이디는 건너뜁니다)
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder={'naverid1|password1|홍길동 / 900101\nnaverid2|password2'}
          className={cn(inputClass, 'mt-1 resize-y font-mono text-xs')}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="block w-48 text-xs font-medium text-gray-600">
          새 계정의 용도
          <div className="mt-1">
            <RoleInput value={role} onChange={setRole} roles={roles} />
          </div>
        </label>
        <span className="pb-2 text-xs text-gray-400">{lines}줄</span>
        <button
          type="submit"
          disabled={saving || !lines}
          className="ml-auto rounded-lg bg-zz-600 px-5 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-60"
        >
          {saving ? '추가 중…' : `${lines}개 추가`}
        </button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      {result && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{result}</p>}
    </form>
  );
}

/* ── 선택한 계정 한꺼번에 바꾸기 ─────────────────── */

function BulkBar({ ids, roles, onDone, onClear }: { ids: number[]; roles: string[]; onDone: () => void; onClear: () => void }) {
  const [role, setRole] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = async (patch: { role?: string; usable?: boolean; working?: boolean }) => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`${BASE}/bulk`, { method: 'POST', body: JSON.stringify({ ids, ...patch }) });
      setRole('');
      onDone();
    } catch (err) {
      setError(message(err, '바꾸지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const chip = 'rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50';

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zz-100 bg-zz-50/60 px-5 py-2.5">
      <span className="text-sm font-semibold text-zz-700">{ids.length}개 선택</span>
      <div className="flex items-center gap-1">
        <div className="w-32">
          <RoleInput value={role} onChange={setRole} roles={roles} />
        </div>
        <button type="button" disabled={saving || !role.trim()} onClick={() => apply({ role: role.trim() })} className={chip}>
          용도 바꾸기
        </button>
      </div>
      <button type="button" disabled={saving} onClick={() => apply({ usable: true })} className={chip}>
        사용 가능
      </button>
      <button type="button" disabled={saving} onClick={() => apply({ usable: false })} className={chip}>
        정지
      </button>
      <button type="button" disabled={saving} onClick={() => apply({ working: false })} className={chip}>
        작업 중 해제
      </button>
      <button type="button" onClick={onClear} className="ml-auto text-xs text-gray-500 hover:underline">
        선택 해제
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </div>
  );
}

/* ── 목록 ─────────────────────────────────────────── */

export function NworkAdmin({ data, filters }: { data: Paged<NworkAccount> & { summary: NworkSummary }; filters: NworkFilters }) {
  const router = useRouter();
  const { items, total, page, size, summary } = data;
  const [search, setSearch] = useState(filters.q);
  const [panel, setPanel] = useState<'new' | 'import' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 용도 후보: 늘 쓰는 것 + DB 에 실제로 있는 것
  const roles = Array.from(new Set([...KNOWN_ROLES, ...summary.roles.map((r) => r.role)]));

  const go = (next: Partial<NworkFilters>) => {
    setSelected([]);
    router.push(hrefFor({ ...filters, ...next }));
  };

  const refresh = () => {
    setPanel(null);
    setEditingId(null);
    setSelected([]);
    router.refresh();
  };

  const remove = async (account: NworkAccount) => {
    if (!window.confirm(`'${account.loginId}' 계정을 지울까요? 되돌릴 수 없습니다.`)) return;
    setError(null);
    try {
      await apiFetch(`${BASE}/${account.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      setError(message(err, '지우지 못했습니다.'));
    }
  };

  const allOnPage = items.length > 0 && items.every((item) => selected.includes(item.id));
  const toggleAll = () => setSelected(allOnPage ? [] : items.map((item) => item.id));
  const toggleOne = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const statChip = (label: string, count: number, active: boolean, next: Partial<NworkFilters>) => (
    <button
      key={label}
      type="button"
      onClick={() => go(next)}
      className={cn(
        'rounded-lg border px-3 py-2 text-left transition',
        active ? 'border-zz-300 bg-zz-50' : 'border-gray-200 bg-white hover:bg-gray-50',
      )}
    >
      <span className="block text-[11px] text-gray-500">{label}</span>
      <span className="text-base font-bold text-gray-900">{formatNumber(count)}</span>
    </button>
  );

  const noFilter = !filters.q && !filters.role && !filters.usable && !filters.working;

  return (
    <div className="space-y-4">
      {/* 요약 — 누르면 그 조건으로 거른다 */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
        {statChip('전체', summary.total, noFilter, { q: '', role: '', usable: '', working: '' })}
        {statChip('사용 가능', summary.usable, filters.usable === '1', { usable: filters.usable === '1' ? '' : '1' })}
        {statChip('정지', summary.total - summary.usable, filters.usable === '0', { usable: filters.usable === '0' ? '' : '0' })}
        {statChip('작업 중', summary.working, filters.working === '1', { working: filters.working === '1' ? '' : '1' })}
        {summary.roles.map((r) => statChip(r.role, r.count, filters.role === r.role, { role: filters.role === r.role ? '' : r.role }))}
      </div>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-5 py-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go({ q: search.trim() });
            }}
            // 모바일에서는 검색칸이 한 줄을 다 쓰고, 버튼들은 다음 줄로
            className="flex min-w-0 basis-full items-center gap-1 sm:basis-auto sm:flex-1"
          >
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="아이디 · 메모 검색"
                className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-zz-400"
              />
            </div>
            {filters.q && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  go({ q: '' });
                }}
                aria-label="검색 지우기"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            )}
          </form>
          <span className="text-sm text-gray-500">{formatNumber(total)}개</span>
          <button
            type="button"
            onClick={() => setPanel(panel === 'import' ? null : 'import')}
            className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ListPlus size={14} /> 여러 개 추가
          </button>
          <button
            type="button"
            onClick={() => setPanel(panel === 'new' ? null : 'new')}
            className="flex items-center gap-1 rounded-lg bg-zz-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zz-700"
          >
            <Plus size={14} /> 새 계정
          </button>
        </header>

        {panel === 'new' && <AccountForm draft={emptyDraft()} roles={roles} onDone={refresh} />}
        {panel === 'import' && <ImportForm roles={roles} onDone={() => router.refresh()} />}
        {selected.length > 0 && <BulkBar ids={selected} roles={roles} onDone={refresh} onClear={() => setSelected([])} />}
        {error && <p className="border-b border-gray-100 bg-red-50 px-5 py-2 text-xs text-red-600">{error}</p>}

        {items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400">조건에 맞는 계정이 없습니다.</p>
        ) : (
          // 표가 넓어서 모바일에서는 이 상자 안에서만 가로로 밀린다 (페이지 전체는 안 밀리게)
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-[11px] font-semibold text-gray-500">
                  <th className="w-10 px-4 py-2">
                    <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="이 페이지 전체 선택" className="accent-zz-600" />
                  </th>
                  <th className="px-2 py-2">번호</th>
                  <th className="px-2 py-2">아이디</th>
                  <th className="px-2 py-2">비밀번호</th>
                  <th className="px-2 py-2">메모1</th>
                  <th className="px-2 py-2">메모2</th>
                  <th className="px-2 py-2">용도</th>
                  <th className="px-2 py-2">상태</th>
                  <th className="px-2 py-2">최근 작업</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((account) => (
                  <AccountRow
                    key={account.id}
                    account={account}
                    roles={roles}
                    selected={selected.includes(account.id)}
                    editing={editingId === account.id}
                    onSelect={() => toggleOne(account.id)}
                    onEdit={() => setEditingId(editingId === account.id ? null : account.id)}
                    onDelete={() => remove(account)}
                    onSaved={refresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {total > size && <Pagination page={page} total={total} size={size} makeHref={(n) => hrefFor(filters, n)} />}
    </div>
  );
}

function AccountRow({
  account,
  roles,
  selected,
  editing,
  onSelect,
  onEdit,
  onDelete,
  onSaved,
}: {
  account: NworkAccount;
  roles: string[];
  selected: boolean;
  editing: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  return (
    <>
      <tr className={cn('border-b border-gray-100 align-middle', selected && 'bg-zz-50/40', !account.usable && 'text-gray-400')}>
        <td className="px-4 py-2">
          <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`${account.loginId} 선택`} className="accent-zz-600" />
        </td>
        <td className="px-2 py-2 text-xs text-gray-400">{account.id}</td>
        <td className="px-2 py-2">
          <span className="flex items-center gap-0.5">
            <span className="font-mono text-xs font-semibold text-gray-800">{account.loginId}</span>
            <CopyButton text={account.loginId} label="아이디 복사" />
          </span>
        </td>
        <td className="px-2 py-2">
          <PasswordCell id={account.id} />
        </td>
        <td className="max-w-[200px] truncate px-2 py-2 text-xs" title={account.memo1}>
          {account.memo1 || '-'}
        </td>
        <td className="max-w-[180px] truncate px-2 py-2 text-xs" title={account.memo2}>
          {account.memo2 || '-'}
        </td>
        <td className="px-2 py-2">
          <RoleBadge role={account.role} />
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-xs">
          {account.usable ? <span className="text-emerald-700">사용 가능</span> : <span className="text-red-500">정지</span>}
          {account.working && <span className="ml-1 rounded bg-violet-50 px-1 text-[10px] text-violet-700">작업 중</span>}
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-500" title={`로그인 확인 ${shortDate(account.lastLoginCheckAt)}`}>
          {shortDate(account.lastWorkAt)}
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-right">
          <button type="button" onClick={onEdit} aria-label="수정" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
            {editing ? <X size={14} /> : <Pencil size={14} />}
          </button>
          <button type="button" onClick={onDelete} aria-label="삭제" className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={10} className="p-0">
            <AccountForm
              draft={{
                id: account.id,
                loginId: account.loginId,
                password: '',
                memo1: account.memo1,
                memo2: account.memo2,
                memo3: account.memo3,
                usable: account.usable,
                role: account.role,
                working: account.working,
              }}
              roles={roles}
              onDone={onSaved}
            />
          </td>
        </tr>
      )}
    </>
  );
}
