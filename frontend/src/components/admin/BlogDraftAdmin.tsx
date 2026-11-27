'use client';

import { useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import type { BlogProfile } from '@/lib/types';

interface Source { id: number; region: string; datedOn: string }
interface Card { title: string; source: string; columns: string[]; rows: string[][] }
interface Section { text: string; card: Card }
interface SourceLink { title: string; url: string }
interface Draft {
  title: string;
  intro: string;
  middle: string;
  outro: string;
  card: Card;
  comparison: Card;
  morePrices: Section[];
  details: Section[];
  links: SourceLink[];
}
interface QueueItem { id: number; profile: string | null; title: string; status: keyof typeof STATUS; createdAt: string }
interface QueuePage { items: QueueItem[]; total: number; size: number; page: number }

const BASE = '/admin/blog';
const STATUS = { queued: '작성 대기', writing: '입력 중', entered: '편집기 입력 완료' };
const field = 'block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
const button = 'rounded-lg bg-zz-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

function CardPreview({ card }: { card: Card }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 p-3">
      <table className="w-full text-left text-sm">
        <caption className="pb-2 text-left font-semibold">{card.title} · {card.source}</caption>
        <thead><tr>{card.columns.map((column) => <th className="bg-gray-50 p-2" key={column}>{column}</th>)}</tr></thead>
        <tbody>{card.rows.map((row, index) => (
          <tr className="border-b border-gray-100" key={index}>
            {row.map((value, column) => <td className="p-2" key={column}>{value}</td>)}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

export function BlogDraftAdmin({ profiles, sources, queue }: {
  profiles: BlogProfile[];
  sources: Source[];
  queue: QueuePage;
}) {
  const [history, setHistory] = useState(queue);
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

  async function loadPage(page: number) {
    setHistory(await apiFetch<QueuePage>(`${BASE}/drafts?page=${page}`));
  }

  async function removeDraft(item: QueueItem) {
    await apiFetch(`${BASE}/drafts/${item.id}`, { method: 'DELETE' });
    await loadPage(history.page);
    setMessage('원고를 삭제했어요.');
  }

  async function enqueue(current: Draft) {
    await apiFetch(`${BASE}/drafts`, {
      method: 'POST',
      body: JSON.stringify({
        profileId: Number(profileId), sheetId: Number(sheetId),
        title: current.title, intro: current.intro, middle: current.middle, outro: current.outro,
        morePriceTexts: current.morePrices.map((item) => item.text),
        detailTexts: current.details.map((item) => item.text),
        links: current.links,
      }),
    });
    setDraft(null);
    setMessage('작성 대기열에 추가했어요.');
    await loadPage(1);
  }

  function extraSections(current: Draft, key: 'morePrices' | 'details') {
    return current[key].map((item, index) => (
      <div className="space-y-3" key={item.card.title}>
        <label className="block text-sm">{item.card.title} 설명
          <textarea className={field} required maxLength={2000} rows={4} value={item.text}
            onChange={(e) => {
              const text = e.target.value;
              setDraft({ ...current, [key]: current[key].map((section, i) => i === index ? { ...section, text } : section) });
            }} />
        </label>
        <CardPreview card={item.card} />
      </div>
    ));
  }

  const bodyLength = draft
    ? [draft.intro, draft.middle, draft.outro, ...draft.morePrices.map((item) => item.text), ...draft.details.map((item) => item.text)]
        .reduce((total, paragraph) => total + [...paragraph.trim()].length, 0)
    : 0;
  const lastPage = Math.max(1, Math.ceil(history.total / history.size));

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
            <CardPreview card={draft.card} />
            {extraSections(draft, 'morePrices')}
            <label className="block text-sm">가입 조건 해설
              <textarea className={field} required maxLength={6000} rows={4} value={draft.middle}
                onChange={(e) => setDraft({ ...draft, middle: e.target.value })} />
            </label>
            <CardPreview card={draft.comparison} />
            {extraSections(draft, 'details')}
            <label className="block text-sm">마무리
              <textarea className={field} required maxLength={6000} rows={3} value={draft.outro}
                onChange={(e) => setDraft({ ...draft, outro: e.target.value })} />
            </label>
            <p className="text-sm text-gray-600">본문 {bodyLength.toLocaleString()}자 · 이미지 {2 + draft.morePrices.length + draft.details.length}장</p>
            <div className="space-y-3 rounded-lg border border-gray-200 p-3">
              <h3 className="text-sm font-semibold">출처 링크 (선택)</h3>
              {draft.links.length === 0 && <p className="text-sm text-gray-600">출처 링크 없음</p>}
              {draft.links.map((item, index) => (
                <div key={index} className="grid items-end gap-2 sm:grid-cols-[1fr_2fr_auto]">
                  <label className="text-sm">제목
                    <input className={field} required maxLength={100} value={item.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setDraft({ ...draft, links: draft.links.map((link, i) => i === index ? { ...link, title } : link) });
                      }} />
                  </label>
                  <label className="text-sm">링크
                    <input type="url" className={field} required maxLength={2048} value={item.url} placeholder="https://"
                      onChange={(e) => {
                        const url = e.target.value;
                        setDraft({ ...draft, links: draft.links.map((link, i) => i === index ? { ...link, url } : link) });
                      }} />
                  </label>
                  <button type="button" className="px-2 py-2 text-sm text-gray-600 underline"
                    onClick={() => setDraft({ ...draft, links: draft.links.filter((_, i) => i !== index) })}>삭제</button>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 text-sm text-zz-600">
                <button type="button" className="underline disabled:opacity-50"
                  disabled={draft.links.length >= 10 || draft.links.some((link) => link.url === 'https://zzikko.co.kr/sise')}
                  onClick={() => setDraft({ ...draft, links: [...draft.links, { title: '찍고 휴대폰 시세', url: 'https://zzikko.co.kr/sise' }] })}>찍고 링크 추가</button>
                <button type="button" className="underline disabled:opacity-50" disabled={draft.links.length >= 10}
                  onClick={() => setDraft({ ...draft, links: [...draft.links, { title: '', url: '' }] })}>직접 추가</button>
              </div>
            </div>
            <button className={button} disabled={busy || !profileId}>검수 완료 · 작성 대기</button>
          </fieldset>
        </form>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
      <div>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">원고 현황 <span className="text-sm font-normal text-gray-600">{history.total.toLocaleString()}건</span></h3>
          <button type="button" className="text-sm text-zz-600 underline" disabled={busy}
            onClick={() => void request(() => loadPage(history.page))}>새로고침</button>
        </div>
        <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                {['제목', '프로필', '상태', '작성일', '삭제'].map((heading) => (
                  <th key={heading} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 font-medium">{item.title}</td>
                  <td className="whitespace-nowrap px-3 py-2">{item.profile ?? '삭제된 프로필'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{STATUS[item.status]}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">{item.createdAt.slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <button type="button" disabled={busy || item.status === 'writing'}
                      className="whitespace-nowrap rounded-md border border-red-200 px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-40"
                      aria-label={`${item.title} 삭제`}
                      title={item.status === 'writing' ? '입력 중인 원고는 삭제할 수 없어요.' : undefined}
                      onClick={() => {
                        if (confirm(`“${item.title}” 원고를 삭제할까요?`)) void request(() => removeDraft(item));
                      }}>삭제</button>
                  </td>
                </tr>
              ))}
              {history.items.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-600">등록된 원고가 없어요.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {lastPage > 1 && (
          <nav aria-label="원고 페이지" className="mt-3 flex items-center justify-center gap-3 text-sm">
            <button type="button" className="rounded-md border px-3 py-1.5 disabled:opacity-40"
              disabled={busy || history.page <= 1} onClick={() => void request(() => loadPage(history.page - 1))}>이전</button>
            <span aria-live="polite" className="tabular-nums">{history.page} / {lastPage} 페이지</span>
            <button type="button" className="rounded-md border px-3 py-1.5 disabled:opacity-40"
              disabled={busy || history.page >= lastPage} onClick={() => void request(() => loadPage(history.page + 1))}>다음</button>
          </nav>
        )}
      </div>
    </section>
  );
}
