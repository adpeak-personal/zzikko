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
  proxyHost: string;
  proxyPort: string;
  proxyUser: string;
  proxyPass: string;
  userAgent: string;
  note: string;
  expectedIp: string;
  vpnLocation: string;
  active: boolean;
}

const EMPTY: Draft = {
  name: '',
  proxyHost: '',
  proxyPort: '',
  proxyUser: '',
  proxyPass: '',
  userAgent: '',
  note: '',
  expectedIp: '',
  vpnLocation: '',
  active: true,
};

const toDraft = (item: BlogProfile): Draft => ({
  name: item.name,
  proxyHost: item.proxyHost,
  proxyPort: item.proxyPort === null ? '' : String(item.proxyPort),
  proxyUser: item.proxyUser,
  // 비밀번호는 내려받지 않는다 — 비워 두면 그대로 두고, 적으면 바꾼다
  proxyPass: '',
  userAgent: item.userAgent,
  note: item.note,
  expectedIp: item.expectedIp,
  vpnLocation: item.vpnLocation,
  active: item.active,
});

/**
 * 프로필 목록과 편집.
 *
 * 프록시 비밀번호는 **화면에 보여주지 않는다.** 목록 API 가 아예 안 내려주고(`hasProxyPass` 만 온다),
 * 작업기(py)만 `/admin/blog/runner` 로 받아 간다.
 */
export function BlogProfileAdmin({ items }: { items: BlogProfile[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 프록시는 평소엔 접어 둔다 — VPN 프로그램을 쓰면 쓸 일이 없고, 실수로 자기 IP 를 적기 쉽다
  const [useProxy, setUseProxy] = useState(false);

  const open = (item: BlogProfile | null) => {
    setError(null);
    setEditing(item ? item.id : 'new');
    setDraft(item ? toDraft(item) : EMPTY);
    // 이미 프록시를 쓰고 있던 프로필이면 펼쳐서 보여준다
    setUseProxy(Boolean(item?.proxyHost));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      name: draft.name.trim(),
      // 접어 둔 상태로 저장하면 프록시를 안 쓰겠다는 뜻이다
      proxyHost: useProxy ? draft.proxyHost.trim() : '',
      proxyPort: useProxy && draft.proxyPort.trim() !== '' ? Number(draft.proxyPort) : null,
      proxyUser: useProxy ? draft.proxyUser.trim() : '',
      userAgent: draft.userAgent.trim(),
      note: draft.note.trim(),
      expectedIp: draft.expectedIp.trim(),
      vpnLocation: draft.vpnLocation.trim(),
      active: draft.active,
      // 새로 만들 땐 빈 값이라도 보내고, 고칠 땐 적었을 때만 보낸다
      ...(editing === 'new' || draft.proxyPass ? { proxyPass: useProxy ? draft.proxyPass : '' } : {}),
    };
    try {
      await apiFetch(editing === 'new' ? '/admin/blog/profiles' : `/admin/blog/profiles/${editing}`, {
        method: editing === 'new' ? 'POST' : 'PATCH',
        body: JSON.stringify(body),
      });
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: BlogProfile) => {
    const warn = `프로필 ${item.name} 을 지웁니다.\n붙어 있던 계정 ${item.accounts}개는 남고 프로필만 떨어집니다.`;
    if (!confirm(warn)) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/blog/profiles/${item.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '지우지 못했어요.');
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
          아직 프로필이 없습니다. <b>프로필 추가</b> 를 눌러 산 IP 를 하나씩 넣어주세요.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
              <th className="px-5 py-2 font-medium">이름</th>
              <th className="px-2 py-2 font-medium">보여야 할 IP</th>
              <th className="w-20 px-2 py-2 text-center font-medium">쓸 수 있는 계정</th>
              <th className="w-28 px-2 py-2 text-right font-medium">마지막 성공</th>
              <th className="w-12 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-5 py-2">
                  <button type="button" onClick={() => open(item)} className="font-medium text-gray-900 hover:underline">
                    {item.name}
                  </button>
                  {!item.active && <span className="ml-1.5 text-xs text-gray-400">쉬는 중</span>}
                  {item.note && <p className="text-xs text-gray-400">{item.note}</p>}
                </td>
                <td className="px-2 py-2">
                  {item.expectedIp ? (
                    <span className="font-mono text-gray-700">{item.expectedIp}</span>
                  ) : (
                    // 비어 있으면 작업기가 처음 성공했을 때 적어 넣는다
                    <span className="text-xs text-gray-400">첫 작업 때 기록됨</span>
                  )}
                  {item.vpnLocation && <p className="text-xs text-gray-400">{item.vpnLocation}</p>}
                  {item.proxyHost && (
                    <p className="text-xs text-gray-400">
                      프록시 {item.proxyHost}
                      {item.proxyPort ? `:${item.proxyPort}` : ''}
                      {item.proxyUser && !item.hasProxyPass && <span className="text-amber-600"> 비밀번호 없음</span>}
                    </p>
                  )}
                </td>
                <td className={cn('px-2 py-2 text-center tabular-nums', item.accounts === 0 && 'text-gray-300')}>
                  {item.usable}
                  {/* 막혀서 내려간 계정이 있으면 "쓸 수 있는 수 / 붙은 수" 로 보여준다 */}
                  {item.usable !== item.accounts && (
                    <span className="text-xs text-gray-400"> / {item.accounts}</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right text-xs text-gray-400">
                  {item.lastOkAt ? formatDate(item.lastOkAt) : '—'}
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={busy}
                    aria-label={`${item.name} 지우기`}
                    className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

          {/* 프록시는 평소엔 접어 둔다. VPN 프로그램을 쓰면 쓸 일이 없는 칸이다 */}
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={useProxy}
              onChange={(event) => setUseProxy(event.target.checked)}
              className="accent-zz-600"
            />
            프록시 서버를 거쳐서 내보내기
            <span className="text-xs text-gray-400">VPN 프로그램을 쓰면 끈 채로 둡니다</span>
          </label>

          {useProxy && (
            <div className="mt-3 grid gap-3 rounded-lg border border-gray-200 bg-white p-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-gray-500 sm:col-span-2">
              프록시 주소
              <span className="font-normal text-gray-400">
                {' '}
                — VPN 업체가 준 주소입니다. <b>내 IP 를 적는 칸이 아닙니다</b>
              </span>
              <input
                value={draft.proxyHost}
                onChange={(event) => setDraft({ ...draft, proxyHost: event.target.value })}
                placeholder="지금 쓰는 회선 그대로 나가려면 비워 두세요"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-xs font-semibold text-gray-500">
              포트
              <input
                value={draft.proxyPort}
                onChange={(event) => setDraft({ ...draft, proxyPort: event.target.value.replace(/[^0-9]/g, '') })}
                inputMode="numeric"
                placeholder="8080"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-xs font-semibold text-gray-500">
              프록시 아이디
              <input
                value={draft.proxyUser}
                onChange={(event) => setDraft({ ...draft, proxyUser: event.target.value })}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="block text-xs font-semibold text-gray-500">
              프록시 비밀번호
              <input
                type="password"
                value={draft.proxyPass}
                onChange={(event) => setDraft({ ...draft, proxyPass: event.target.value })}
                placeholder={editing === 'new' ? '' : '바꿀 때만 입력'}
                autoComplete="new-password"
                className={`mt-1 ${inputClass}`}
              />
            </label>
            </div>
          )}

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
