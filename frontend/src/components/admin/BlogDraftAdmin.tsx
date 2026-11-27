'use client';

import { useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import type { BlogProfile } from '@/lib/types';

interface Source { id: number; region: string; datedOn: string }
interface Draft {
  title: string;
  intro: string;
  outro: string;
  card: { title: string; source: string; columns: string[]; rows: string[][] };
}
interface QueueItem { id: number; profile: string | null; title: string; status: keyof typeof STATUS }

const BASE = '/admin/blog';
const STATUS = { queued: '작성 대기', writing: '입력 중', entered: '편집기 입력 완료' };
const field = 'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
const button = 'rounded-lg bg-zz-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export function BlogDraftAdmin({ profiles, sources, queue }: {
  profiles: BlogProfile[];
  sources: Source[];
  queue: QueueItem[];
}) {
  const [items, setItems] = useState(queue);
  const [sheetId, setSheetId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function request(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : '원고 요청을 처리하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const { items } = await apiFetch<{ items: QueueItem[] }>(`${BASE}/drafts`);
    setItems(items);
  }

  async function enqueue(current: Draft) {
    await apiFetch(`${BASE}/drafts`, {
      method: 'POST',
      body: JSON.stringify({
        profileId: Number(profileId), sheetId: Number(sheetId),
        title: current.title, intro: current.intro, outro: current.outro,
      }),
    });
    setDraft(null);
    setMessage('작성 대기열에 추가했어요.');
    await refresh();
  }

  return (
    <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-lg font-bold">휴대폰 성지 원고</h2>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">지역 · 기준일
          <select className={field} value={sheetId} onChange={(e) => { setSheetId(e.target.value); setDraft(null); }}>
            <option value="">시세표 선택</option>
            {sources.map((item) => <option key={item.id} value={item.id}>{item.region} · {item.datedOn} (#{item.id})</option>)}
          </select>
        </label>
        <label className="text-sm">대상 블로그
          <select className={field} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">프로필 선택</option>
            {profiles.filter((p) => p.active && !p.pendingDelete).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <button type="button" className={button} disabled={!sheetId || busy} onClick={() => void request(async () => {
          setDraft(await apiFetch<Draft>(`${BASE}/draft-sources/${sheetId}`));
        })}>초안 만들기</button>
      </fieldset>
      {draft && (
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void request(() => enqueue(draft)); }}>
          <fieldset disabled={busy} className="space-y-3">
            <label className="block text-sm">제목
              <input className={field} required maxLength={200} value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="block text-sm">시세표 앞 본문
              <textarea className={field} required maxLength={6000} rows={3} value={draft.intro}
                onChange={(e) => setDraft({ ...draft, intro: e.target.value })} />
            </label>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="pb-2 text-left font-semibold">{draft.card.title} · {draft.card.source}</caption>
                <thead><tr>{draft.card.columns.map((column) => <th className="bg-gray-50 p-2" key={column}>{column}</th>)}</tr></thead>
                <tbody>{draft.card.rows.map((row, index) => (
                  <tr className="border-b border-gray-100" key={index}>
                    {row.map((value, column) => <td className="p-2" key={column}>{value}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <label className="block text-sm">시세표 뒤 본문
              <textarea className={field} required maxLength={6000} rows={3} value={draft.outro}
                onChange={(e) => setDraft({ ...draft, outro: e.target.value })} />
            </label>
            <button className={button} disabled={busy || !profileId}>검수 완료 · 작성 대기</button>
          </fieldset>
        </form>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">원고 현황</h3>
          <button type="button" className="text-sm text-zz-600 underline" disabled={busy}
            onClick={() => void request(refresh)}>새로고침</button>
        </div>
        {items.length ? <ul className="mt-2 divide-y divide-gray-100 text-sm">
          {items.map((item) => <li className="flex flex-wrap justify-between gap-2 py-2" key={item.id}>
            <span>{item.title} · {item.profile ?? '삭제된 프로필'}</span><span>{STATUS[item.status]}</span>
          </li>)}
        </ul> : <p className="mt-2 text-sm text-gray-600">등록된 원고가 없어요.</p>}
      </div>
    </section>
  );
}
