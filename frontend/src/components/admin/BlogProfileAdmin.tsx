'use client';

import { Fragment, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { BlogProfile } from '@/lib/types';

const BASE = '/admin/blog/profiles';
const inputClass = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-zz-400';

interface Draft {
  name: string;
  userAgent: string;
  note: string;
  expectedIp: string;
  vpnLocation: string;
  active: boolean;
}

const EMPTY: Draft = { name: '', userAgent: '', note: '', expectedIp: '', vpnLocation: '', active: true };

const toDraft = (item: BlogProfile): Draft => ({
  name: item.name,
  userAgent: item.userAgent,
  note: item.note,
  expectedIp: item.expectedIp,
  vpnLocation: item.vpnLocation,
  active: item.active,
});

const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/**
 * 블로그 작업 프로필 — 표로 보여주고, 고치는 건 모달에서.
 *
 * 체크박스로 여러 줄을 골라 **한 번에 쓰기/쉬기** 를 할 수 있다. 같은 IP 에 프로필이 여럿일 때
 * 이번에 어느 아이디를 돌릴지 고르는 자리다 — 쉬는 프로필은 작업기가 건너뛴다.
 *
 * ⚠️ **프록시 칸은 화면에 없다.** DB·API 에는 그대로 있다. VPN 프로그램을 쓰는 지금 구조에선
 * 쓸 일이 없고 "IP 적는 칸" 으로 오해하기 쉬워서 뺐다.
 */
export function BlogProfileAdmin({ items }: { items: BlogProfile[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<BlogProfile | 'new' | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (err: unknown, fallback: string) => setError(message(err, fallback));
  const done = () => {
    setSelected([]);
    router.refresh();
  };

  const allChecked = items.length > 0 && items.every((item) => selected.includes(item.id));
  const toggleAll = () => setSelected(allChecked ? [] : items.map((item) => item.id));
  const toggleOne = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const bulkActive = async (active: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`${BASE}/bulk`, { method: 'POST', body: JSON.stringify({ ids: selected, active }) });
      done();
    } catch (err) {
      fail(err, '바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`프로필 ${selected.length}개를 지웁니다.\n붙어 있던 아이디는 남고 프로필만 떨어집니다.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`${BASE}/bulk-delete`, { method: 'POST', body: JSON.stringify({ ids: selected }) });
      done();
    } catch (err) {
      fail(err, '지우지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const removeOne = async (item: BlogProfile) => {
    if (!confirm(`프로필 ${item.name} 을 지웁니다.\n붙어 있던 아이디는 남고 프로필만 떨어집니다.`)) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`${BASE}/${item.id}`, { method: 'DELETE' });
      done();
    } catch (err) {
      fail(err, '지우지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  /** 표에서 바로 쓰기/쉬기 — 여러 개 바꾸는 길을 하나짜리로 쓴다 */
  const setActive = async (item: BlogProfile, active: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`${BASE}/bulk`, { method: 'POST', body: JSON.stringify({ ids: [item.id], active }) });
      router.refresh();
    } catch (err) {
      fail(err, '바꾸지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-5 py-2.5">
        <h2 className="font-bold text-gray-900">
          프로필 <span className="text-sm font-normal text-gray-400">{items.length}개</span>
        </h2>
        <button
          type="button"
          onClick={() => setEditing('new')}
          className="ml-auto flex items-center gap-1 rounded-lg bg-zz-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zz-700"
        >
          <Plus size={14} /> 프로필 추가
        </button>
      </header>

      {error && <p className="border-b border-gray-100 bg-red-50 px-5 py-2 text-xs text-red-600">{error}</p>}

      {/* 고른 줄에 한 번에 — 같은 IP 에서 이번에 돌릴 아이디를 고르는 자리 */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-zz-100 bg-zz-50/60 px-5 py-2.5">
          <span className="text-sm font-semibold text-zz-700">{selected.length}개 선택</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulkActive(true)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            쓰기
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => bulkActive(false)}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            쉬기
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={bulkDelete}
            className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            지우기
          </button>
          <button type="button" onClick={() => setSelected([])} className="ml-auto text-xs text-gray-500 hover:underline">
            선택 해제
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">
          아직 프로필이 없습니다. <b>프로필 추가</b> 를 눌러 하나씩 만들어 주세요.
        </p>
      ) : (
        // 표가 넓어서 모바일에서는 이 상자 안에서만 가로로 밀린다
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-[11px] font-semibold text-gray-500">
                <th className="w-10 px-4 py-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="전체 선택"
                    className="accent-zz-600"
                  />
                </th>
                <th className="px-2 py-2">프로필</th>
                <th className="px-2 py-2">아이디</th>
                <th className="px-2 py-2">VPN 위치</th>
                <th className="px-2 py-2">메모</th>
                <th className="w-24 px-2 py-2">상태</th>
                <th className="w-24 px-2 py-2 text-right">마지막 성공</th>
                <th className="w-20 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                // 목록이 IP 순으로 오므로, IP 가 바뀌는 자리에만 머리글 줄을 끼운다
                const newGroup = index === 0 || items[index - 1]!.expectedIp !== item.expectedIp;
                const account = item.accounts[0];
                const checked = selected.includes(item.id);
                return (
                  <Fragment key={item.id}>
                    {newGroup && (
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <td colSpan={8} className="px-5 py-1.5 text-xs font-semibold text-gray-500">
                          {item.expectedIp ? (
                            <span className="font-mono">{item.expectedIp}</span>
                          ) : (
                            <span className="font-normal text-gray-400">IP 미정 — 첫 작업 때 기록됩니다</span>
                          )}
                        </td>
                      </tr>
                    )}

                    <tr className={cn('border-b border-gray-50 align-middle', checked && 'bg-zz-50/40', !item.active && 'text-gray-400')}>
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOne(item.id)}
                          aria-label={`${item.name} 선택`}
                          className="accent-zz-600"
                        />
                      </td>
                      <td className="px-2 py-2 font-medium text-gray-900">{item.name}</td>
                      <td className="px-2 py-2">
                        {account ? (
                          <>
                            <span className="font-mono text-xs">{account.loginId}</span>
                            {!account.usable && <span className="ml-1 text-xs text-amber-600">쓸 수 없음</span>}
                            {/* 프로필 하나에 아이디 하나가 원칙이다. 어긋났으면 숨기지 않고 알린다 */}
                            {item.accounts.length > 1 && (
                              <span className="ml-1 text-xs text-red-600">외 {item.accounts.length - 1}개</span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-gray-300">아이디 없음</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-500">{item.vpnLocation || '-'}</td>
                      <td className="max-w-[200px] truncate px-2 py-2 text-xs text-gray-500" title={item.note}>
                        {item.note || '-'}
                      </td>
                      <td className="px-2 py-2">
                        {/* 같은 IP 에서 이번에 돌릴 것만 켜 두면 된다 — 쉬는 프로필은 작업기가 건너뛴다 */}
                        <select
                          value={item.active ? '1' : '0'}
                          disabled={busy}
                          onChange={(event) => void setActive(item, event.target.value === '1')}
                          aria-label={`${item.name} 상태`}
                          className={cn(
                            'rounded border border-transparent bg-transparent py-0.5 pl-1 pr-5 text-xs outline-none hover:border-gray-200 focus:border-zz-400 disabled:opacity-50',
                            item.active ? 'text-emerald-700' : 'text-gray-400',
                          )}
                        >
                          <option value="1">쓰는 중</option>
                          <option value="0">쉬는 중</option>
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-xs text-gray-400">
                        {item.lastOkAt ? formatDate(item.lastOkAt) : '-'}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setEditing(item)}
                          aria-label={`${item.name} 고치기`}
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeOne(item)}
                          disabled={busy}
                          aria-label={`${item.name} 지우기`}
                          className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing !== null && (
        <EditModal
          profile={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            done();
          }}
        />
      )}
    </section>
  );
}

/* ── 고치기 · 새로 만들기 모달 ─────────────────────── */

function EditModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: BlogProfile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(profile ? toDraft(profile) : EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isNew = profile === null;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return setError('이름을 입력해 주세요.');

    setSaving(true);
    setError(null);
    try {
      await apiFetch(isNew ? BASE : `${BASE}/${profile.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify({
          name: draft.name.trim(),
          userAgent: draft.userAgent.trim(),
          note: draft.note.trim(),
          expectedIp: draft.expectedIp.trim(),
          vpnLocation: draft.vpnLocation.trim(),
          active: draft.active,
        }),
      });
      onSaved();
    } catch (err) {
      setError(message(err, '저장하지 못했어요.'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={isNew ? '새 프로필' : '프로필 고치기'}>
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="닫기" />

      <form
        onSubmit={save}
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-900">{isNew ? '새 프로필' : '프로필 고치기'}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100" aria-label="닫기">
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-gray-500">
            이름 (크롬 프로필 폴더가 됩니다)
            <input
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="prof-01"
              autoFocus
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs font-semibold text-gray-500">
            메모
            <input
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              placeholder="VPN 업체 / 지역 등"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs font-semibold text-gray-500">
            보여야 할 IP
            <span className="font-normal text-gray-400"> — 다르면 작업기가 멈춥니다</span>
            <input
              value={draft.expectedIp}
              onChange={(event) => setDraft({ ...draft, expectedIp: event.target.value })}
              placeholder="비워 두면 첫 작업 때 기록됩니다"
              className={`mt-1 font-mono ${inputClass}`}
            />
          </label>
          <label className="block text-xs font-semibold text-gray-500">
            VPN 위치 이름
            <span className="font-normal text-gray-400"> — 자동 전환에 씁니다</span>
            <input
              value={draft.vpnLocation}
              onChange={(event) => setDraft({ ...draft, vpnLocation: event.target.value })}
              placeholder="Korea #5"
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="block text-xs font-semibold text-gray-500 sm:col-span-2">
            User-Agent (비우면 작업기 기본값)
            <input
              value={draft.userAgent}
              onChange={(event) => setDraft({ ...draft, userAgent: event.target.value })}
              className={`mt-1 ${inputClass}`}
            />
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-600 sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              className="accent-zz-600"
            />
            쓰는 프로필 (끄면 작업기가 건너뜁니다)
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600 sm:col-span-2">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">
            취소
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-zz-600 px-5 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}
