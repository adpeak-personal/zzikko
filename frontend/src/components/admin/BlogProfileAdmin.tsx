'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { formatDate } from '@/lib/utils';
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

  // 고치는 칸. **고칠 줄 바로 아래**에 끼워 넣으려고 따로 빼 두었다 —
  // 목록 맨 아래에 뜨면 어느 줄을 고치는 중인지 헷갈린다.
  const editPanel = (
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
  );

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

      {/* 새 프로필은 '프로필 추가' 버튼 바로 밑에 */}
      {editing === 'new' && editPanel}

      {items.length === 0 && editing === null ? (
        <p className="py-12 text-center text-sm text-gray-400">
          아직 프로필이 없습니다. <b>프로필 추가</b> 를 눌러 IP 하나씩 만들어 주세요.
        </p>
      ) : (
        <div>
          {items.map((item, index) => {
            // IP 가 바뀌는 자리에만 머리글을 둔다 (목록이 IP 순으로 정렬돼 온다)
            const newGroup = index === 0 || items[index - 1]!.expectedIp !== item.expectedIp;
            const account = item.accounts[0];
            return (
              <div key={item.id}>
                {newGroup && (
                  <p className="border-b border-gray-100 bg-gray-50 px-5 py-1.5 text-xs font-semibold text-gray-500">
                    {item.expectedIp ? (
                      <span className="font-mono">{item.expectedIp}</span>
                    ) : (
                      <span className="font-normal text-gray-400">IP 미정 — 첫 작업 때 기록됩니다</span>
                    )}
                  </p>
                )}

                <div className="flex items-start justify-between gap-3 border-b border-gray-50 px-5 py-3">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => open(item)}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {item.name}
                    </button>
                    {!item.active && <span className="ml-1.5 text-xs text-gray-400">쉬는 중</span>}

                    {/* 프로필 하나에 아이디 하나가 원칙이다 */}
                    {account ? (
                      <p className="mt-0.5 text-sm text-gray-700">
                        {account.loginId}
                        {!account.usable && <span className="ml-1 text-xs text-amber-600">쓸 수 없음</span>}
                        {account.lastLoginCheckAt && (
                          <span className="ml-1.5 text-xs text-gray-400">
                            로그인 확인 {formatDate(account.lastLoginCheckAt)}
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-gray-400">
                        붙은 아이디가 없습니다.{' '}
                        <a href="/admin/nwork" className="font-semibold text-zz-600 hover:underline">
                          네이버 계정
                        </a>{' '}
                        에서 <b>블로그 프로필</b> 칸에 <code>{item.name}</code> 을 적어주세요.
                      </p>
                    )}

                    {/* 원칙을 어긴 상태는 숨기지 않고 보여준다 — 옛 데이터일 수 있다 */}
                    {item.accounts.length > 1 && (
                      <p className="mt-0.5 text-xs text-red-600">
                        아이디가 {item.accounts.length}개 붙어 있습니다 ({item.accounts.map((a) => a.loginId).join(', ')}).
                        프로필 하나에 하나만 두세요.
                      </p>
                    )}

                    {(item.vpnLocation || item.note) && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {[item.vpnLocation, item.note].filter(Boolean).join(' · ')}
                      </p>
                    )}
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

                {/* 고치는 칸은 그 줄 바로 아래에 */}
                {editing === item.id && editPanel}
              </div>
            );
          })}
        </div>
      )}

    </section>
  );
}
