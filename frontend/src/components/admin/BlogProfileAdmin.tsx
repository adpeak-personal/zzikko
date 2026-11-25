'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { BlogProfile } from '@/lib/types';

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

/**
 * 프로필 목록과 편집.
 *
 * ⚠️ **프록시 칸은 화면에 없다.** DB·API 에는 그대로 있지만, VPN 프로그램을 쓰는 지금
 * 구조에서는 쓸 일이 없고 "내 IP 적는 칸" 으로 오해하기 쉬워서 뺐다. 프록시를 사게 되면
 * 이 파일에 칸을 다시 넣으면 된다 — 뒤쪽은 건드릴 것이 없다.
 */
export function BlogProfileAdmin({ items }: { items: BlogProfile[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (item: BlogProfile | null) => {
    setError(null);
    setEditing(item ? item.id : 'new');
    setDraft(item ? toDraft(item) : EMPTY);
  };

  const fail = (err: unknown, fallback: string) => setError(err instanceof ApiError ? err.message : fallback);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(editing === 'new' ? '/admin/blog/profiles' : `/admin/blog/profiles/${editing}`, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        body: JSON.stringify({
          name: draft.name.trim(),
          userAgent: draft.userAgent.trim(),
          note: draft.note.trim(),
          expectedIp: draft.expectedIp.trim(),
          vpnLocation: draft.vpnLocation.trim(),
          active: draft.active,
        }),
      });
      setEditing(null);
      router.refresh();
    } catch (err) {
      fail(err, '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: BlogProfile) => {
    const warn = `프로필 ${item.name} 을 지웁니다.\n붙어 있던 계정 ${item.accounts.length}개는 남고 프로필만 떨어집니다.`;
    if (!confirm(warn)) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/blog/profiles/${item.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      fail(err, '지우지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  /** 지금 쓸 아이디 고르기. 고른 것을 다시 누르면 해제된다 */
  const pick = async (item: BlogProfile, accountId: number) => {
    const next = item.currentAccountId === accountId ? null : accountId;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/blog/profiles/${item.id}/account`, {
        method: 'PATCH',
        body: JSON.stringify({ accountId: next }),
      });
      router.refresh();
    } catch (err) {
      fail(err, '고르지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="font-bold text-gray-900">
          프로필 {items.length > 0 && <span className="text-sm font-normal text-gray-400">{items.length}개</span>}
        </h2>
        <button
          type="button"
          onClick={() => open(null)}
          className="flex items-center gap-1 rounded-lg bg-zz-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zz-700"
        >
          <Plus size={14} /> 프로필 추가
        </button>
      </header>

      {error && <p className="border-b border-gray-100 bg-red-50 px-5 py-2 text-xs text-red-600">{error}</p>}

      {items.length === 0 && editing === null ? (
        <p className="py-12 text-center text-sm text-gray-400">
          아직 프로필이 없습니다. <b>프로필 추가</b> 를 눌러 IP 하나씩 만들어 주세요.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id} className="px-5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <button type="button" onClick={() => open(item)} className="font-medium text-gray-900 hover:underline">
                    {item.name}
                  </button>
                  {!item.active && <span className="ml-1.5 text-xs text-gray-400">쉬는 중</span>}
                  <p className="mt-0.5 text-xs text-gray-500">
                    {item.expectedIp ? (
                      <span className="font-mono text-gray-600">{item.expectedIp}</span>
                    ) : (
                      <span className="text-gray-400">IP 는 첫 작업 때 기록됩니다</span>
                    )}
                    {item.vpnLocation && <span className="ml-1.5">· {item.vpnLocation}</span>}
                    {item.note && <span className="ml-1.5">· {item.note}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-gray-400">
                    {item.lastOkAt ? `마지막 성공 ${formatDate(item.lastOkAt)}` : '아직 작업 없음'}
                  </span>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={busy}
                    aria-label={`${item.name} 지우기`}
                    className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* 붙은 아이디 — 지금 쓸 것 하나만 고른다 (주기적으로 돌려 가며 쓴다) */}
              {item.accounts.length === 0 ? (
                <p className="mt-2 text-xs text-gray-400">
                  붙은 아이디가 없습니다.{' '}
                  <a href="/admin/nwork" className="font-semibold text-zz-600 hover:underline">
                    네이버 계정
                  </a>{' '}
                  에서 <b>블로그 프로필</b> 칸에 <code>{item.name}</code> 을 적어주세요.
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
                  {item.accounts.map((account) => {
                    const picked = item.currentAccountId === account.id;
                    return (
                      <label
                        key={account.id}
                        title={account.usable ? '다시 누르면 고름이 풀립니다' : '쓸 수 없음으로 꺼져 있어 작업에서 빠집니다'}
                        className={cn(
                          'flex items-center gap-1.5 text-sm',
                          account.usable ? 'cursor-pointer text-gray-700' : 'cursor-not-allowed text-gray-300',
                        )}
                      >
                        <input
                          type="radio"
                          name={`current-${item.id}`}
                          checked={picked}
                          disabled={busy || !account.usable}
                          onChange={() => pick(item, account.id)}
                          // 라디오는 보통 해제가 안 되므로 같은 것을 다시 누르면 풀어 준다
                          onClick={() => picked && pick(item, account.id)}
                          className="accent-zz-600"
                        />
                        <span className={cn(picked && 'font-semibold text-zz-700')}>{account.loginId}</span>
                        {!account.usable && <span className="text-xs">(꺼짐)</span>}
                      </label>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
          <h3 className="text-sm font-bold text-gray-900">{editing === 'new' ? '새 프로필' : '프로필 고치기'}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-gray-500">
              이름 (크롬 프로필 폴더가 됩니다)
              <input
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                placeholder="prof-01"
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
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
              className="accent-zz-600"
            />
            쓰는 프로필 (끄면 작업기가 건너뜁니다)
          </label>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={busy || !draft.name.trim()}
              className="rounded-lg bg-zz-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-50"
            >
              {busy ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-white"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
