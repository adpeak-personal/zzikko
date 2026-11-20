'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link2, Trash2, Upload } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { Carrier, JoinType, SiseKeyword, SiseReport, SiseRow } from '@/lib/types';
import { SiseKeywords, type KeywordPick } from './SiseKeywords';

const CARRIERS: Carrier[] = ['SKT', 'KT', 'LG U+'];
const JOINS: JoinType[] = ['번호이동', '기기변경'];

interface Draft {
  imageUrl: string;
  note: string;
  rows: SiseRow[];
}

/** 붙어 있는 키워드를 읽기 좋게 띄운다 — '수원휴대폰성지' → '수원 휴대폰 성지' */
function spaceKeyword(keyword: string) {
  return keyword
    .replace(/(휴대폰|핸드폰|성지|시세표|시세)/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 고른 키워드로 제목을 만든다.
 *
 * 제목에 키워드가 그대로 들어가야 검색에 걸린다. 이미 '시세'가 든 키워드에
 * 또 붙이지 않는다 — "휴대폰 성지 시세표 시세" 같은 제목이 나온다.
 */
function titleFor(pick: KeywordPick | null, region: string, datedOn: string) {
  const [, month = '', day = ''] = datedOn.split('-');
  const when = `(${Number(month)}월 ${Number(day)}일 기준)`;
  if (!pick) return region ? `${region} 휴대폰 성지 시세 ${when}` : '';
  const spaced = spaceKeyword(pick.keyword);
  return `${spaced}${spaced.includes('시세') ? '' : ' 시세'} ${when}`;
}

/** 읽어낸 행을 기종별로 묶는다 — 원본 이미지와 같은 모양이라야 눈으로 대조하기 쉽다 */
function groupRows(rows: SiseRow[]) {
  const groups: { series: string; models: { model: string; storage: string; indexes: Map<string, number> }[] }[] = [];
  rows.forEach((row, index) => {
    let group = groups.find((item) => item.series === row.series);
    if (!group) {
      group = { series: row.series || '기타', models: [] };
      groups.push(group);
    }
    let model = group.models.find((item) => item.model === row.model && item.storage === row.storage);
    if (!model) {
      model = { model: row.model, storage: row.storage, indexes: new Map() };
      group.models.push(model);
    }
    model.indexes.set(`${row.carrier}|${row.joinType}`, index);
  });
  return groups;
}

export function SiseAdmin({
  items,
  aiReady,
  keywords,
  keywordsReady,
}: {
  items: SiseReport[];
  aiReady: boolean;
  keywords: SiseKeyword[];
  keywordsReady: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // 지역은 자유 문자열이다 — 위 키워드에서 고르거나 직접 적는다
  const [region, setRegion] = useState('');
  const [picked, setPicked] = useState<KeywordPick | null>(null);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [datedOn, setDatedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = (err: unknown, fallback: string) =>
    setError(err instanceof ApiError ? err.message : fallback);

  /* 1단계 — 이미지에서 표 읽기 */
  const onPick = async (file: File) => {
    setError(null);
    setBusy('읽는 중');
    try {
      const form = new FormData();
      form.append('file', file);
      // FormData 는 boundary 를 브라우저가 붙이므로 Content-Type 을 직접 넣지 않는다
      const res = await fetch('/api/v1/admin/sise/extract', { method: 'POST', body: form });
      if (!res.ok) throw new ApiError(res.status, (await res.json().catch(() => null))?.message ?? '읽지 못했어요.');
      setDraft(await res.json());
    } catch (err) {
      fail(err, '시세표를 읽지 못했어요.');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  /* 1단계(b) — 이미지 주소로 읽기 */
  const onPickUrl = async () => {
    const url = imageUrl.trim();
    if (!url) return;
    setError(null);
    setBusy('읽는 중');
    try {
      setDraft(await apiFetch<Draft>('/admin/sise/extract', {
        method: 'POST',
        body: JSON.stringify({ imageUrl: url }),
      }));
    } catch (err) {
      fail(err, '그 주소에서 시세표를 읽지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const setPrice = (index: number, value: string) => {
    if (!draft) return;
    const rows = [...draft.rows];
    rows[index] = { ...rows[index], price: Number(value) || 0 };
    setDraft({ ...draft, rows });
  };

  const removeModel = (model: string, storage: string) => {
    if (!draft) return;
    setDraft({ ...draft, rows: draft.rows.filter((row) => !(row.model === model && row.storage === storage)) });
  };

  /* 2단계 — 저장하고 글 만들기 */
  const save = async () => {
    if (!draft) return;
    setError(null);
    setBusy('글 쓰는 중');
    try {
      await apiFetch('/admin/sise/sheets', {
        method: 'POST',
        body: JSON.stringify({
          region,
          title,
          keywordId: picked?.id ?? null,
          datedOn,
          imageUrl: draft.imageUrl,
          note: draft.note,
          rows: draft.rows,
        }),
      });
      setDraft(null);
      setImageUrl('');
      // 글이 만들어졌으니 작성일이 찍힌다 — 목록을 다시 받아야 보인다
      setPicked(null);
      setTitle('');
      router.refresh();
    } catch (err) {
      fail(err, '글을 만들지 못했어요.');
    } finally {
      setBusy(null);
    }
  };

  const patch = async (id: number, body: Record<string, unknown>) => {
    setError(null);
    try {
      await apiFetch(`/admin/sise/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      router.refresh();
    } catch (err) {
      fail(err, '바꾸지 못했어요.');
    }
  };

  const remove = async (report: SiseReport) => {
    if (!window.confirm(`'${report.title}' 을(를) 지울까요? 시세표도 같이 지워집니다.`)) return;
    setError(null);
    try {
      await apiFetch(`/admin/sise/${report.id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      fail(err, '지우지 못했어요.');
    }
  };

  return (
    <div className="space-y-5">
      {!aiReady && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>ANTHROPIC_API_KEY 가 없습니다.</b> 시세표 읽기와 글 작성이 동작하지 않습니다. 서버 설정에 키를 넣어주세요.
        </p>
      )}
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      {/* ── 어느 지역을 쓸지 고르기 ── */}
      <SiseKeywords
        keywords={keywords}
        ready={keywordsReady}
        picked={picked}
        onPick={(pick) => {
          setPicked(pick);
          if (pick) {
            setRegion(pick.place || pick.keyword);
            setTitle(titleFor(pick, pick.place, datedOn));
          }
        }}
      />

      {/* ── 올리기 ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="font-bold text-gray-900">시세표 올리기</h2>
        <p className="mt-1 text-sm text-gray-500">
          이미지를 올리면 표를 읽어옵니다. <b>숫자를 눈으로 확인한 뒤</b> 글을 만드세요.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block text-sm font-semibold text-gray-600">
            지역
            <input
              value={region}
              onChange={(event) => setRegion(event.target.value)}
              placeholder="수원 · 부천 · 강남"
              maxLength={20}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-zz-400"
            />
          </label>

          <label className="block text-sm font-semibold text-gray-600">
            시세 기준일
            <input
              type="date"
              value={datedOn}
              onChange={(event) => setDatedOn(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-zz-400"
            />
          </label>

          <div className="flex items-end">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onPick(file);
              }}
            />
            <button
              type="button"
              disabled={Boolean(busy) || !aiReady}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zz-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-50"
            >
              <Upload size={15} />
              {busy === '읽는 중' ? '읽는 중…' : '시세표 선택'}
            </button>
          </div>
        </div>

        <label className="mt-3 block text-sm font-semibold text-gray-600">
          제목
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="비워두면 AI 가 지은 제목을 씁니다"
            maxLength={200}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-zz-400"
          />
        </label>

        <div className="mt-3">
          <span className="text-sm font-semibold text-gray-600">또는 이미지 주소로</span>
          <div className="mt-1 flex gap-2">
            <input
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://… .png"
              maxLength={1000}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void onPickUrl();
                }
              }}
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-zz-400"
            />
            <button
              type="button"
              disabled={Boolean(busy) || !aiReady || !imageUrl.trim()}
              onClick={() => void onPickUrl()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Link2 size={15} />
              주소로 읽기
            </button>
          </div>
        </div>
      </section>

      {/* ── 검수 ── */}
      {draft && (
        <section className="rounded-xl border-2 border-zz-300 bg-white p-5">
          <h2 className="font-bold text-gray-900">읽어낸 내용 확인</h2>
          <p className="mt-1 text-sm text-gray-500">
            {draft.rows.length}칸을 읽었습니다. <b className="text-zz-700">음수는 페이백</b>입니다 (-75 = 75만원 돌려줌).
            틀린 숫자는 바로 고치세요.
          </p>

          <label className="mt-4 block text-sm font-semibold text-gray-600">
            표에 붙은 조건
            <input
              value={draft.note}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              placeholder="예: KT, LG → SK 유심만 이동시 25% 요금할인"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-zz-400"
            />
          </label>

          <div className="mt-4 space-y-5">
            {groupRows(draft.rows).map((group) => (
              <div key={group.series}>
                <h3 className="mb-1.5 text-sm font-bold text-gray-700">{group.series}</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full min-w-[620px] text-sm">
                    <thead className="bg-gray-50 text-[11px] text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold">기종</th>
                        <th className="px-1 py-1.5 font-semibold">용량</th>
                        {CARRIERS.map((carrier) =>
                          JOINS.map((join) => (
                            <th key={`${carrier}-${join}`} className="px-1 py-1.5 font-semibold">
                              {carrier}
                              <span className="block font-normal">{join === '번호이동' ? '번이' : '기변'}</span>
                            </th>
                          )),
                        )}
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {group.models.map((model) => (
                        <tr key={`${model.model}-${model.storage}`} className="border-t border-gray-100">
                          <td className="px-2 py-1.5 font-semibold text-gray-900">{model.model}</td>
                          <td className="px-1 py-1.5 text-center text-xs text-gray-500">{model.storage}</td>
                          {CARRIERS.map((carrier) =>
                            JOINS.map((join) => {
                              const index = model.indexes.get(`${carrier}|${join}`);
                              return (
                                <td key={`${carrier}-${join}`} className="px-1 py-1.5">
                                  {index === undefined ? (
                                    <span className="block text-center text-gray-300">–</span>
                                  ) : (
                                    <input
                                      type="number"
                                      value={draft.rows[index].price}
                                      onChange={(event) => setPrice(index, event.target.value)}
                                      className={cn(
                                        'w-14 rounded border border-gray-200 px-1 py-0.5 text-center text-sm outline-none focus:border-zz-400',
                                        draft.rows[index].price < 0 && 'font-bold text-zz-600',
                                      )}
                                    />
                                  )}
                                </td>
                              );
                            }),
                          )}
                          <td className="px-1">
                            <button
                              type="button"
                              onClick={() => removeModel(model.model, model.storage)}
                              aria-label={`${model.model} 행 삭제`}
                              className="rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
            <button type="button" onClick={() => setDraft(null)} className="text-sm text-gray-500 hover:underline">
              취소
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={save}
              className="rounded-lg bg-zz-600 px-5 py-2 text-sm font-semibold text-white hover:bg-zz-700 disabled:opacity-50"
            >
              {busy === '글 쓰는 중' ? '글 쓰는 중…' : '확인했습니다 · 글 만들기'}
            </button>
          </div>
        </section>
      )}

      {/* ── 목록 ── */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <header className="border-b border-gray-100 px-5 py-3">
          <h2 className="font-bold text-gray-900">시세 리포트 {items.length}건</h2>
        </header>

        {items.length === 0 ? (
          <p className="py-14 text-center text-sm text-gray-400">아직 만든 글이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((report) => (
              <li key={report.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">
                    {report.sheet.region}
                  </span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                      report.published ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500',
                    )}
                  >
                    {report.published ? '발행됨' : '미발행'}
                  </span>
                  <span className="text-xs text-gray-400">{report.sheet.datedOn} 기준</span>
                  <span className="ml-auto text-xs text-gray-400">{formatDate(report.createdAt)} 작성</span>
                </div>

                <a
                  href={`/sise/${report.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 block font-bold text-gray-900 hover:text-zz-600 hover:underline"
                >
                  {report.title}
                </a>
                {report.summary && <p className="mt-1 line-clamp-2 text-sm text-gray-500">{report.summary}</p>}

                <p className="mt-1.5 text-xs text-gray-400">
                  {report.sheet.rows.length}칸
                  {report.comparedTo ? ` · ${report.comparedTo} 기록과 비교 (변동 ${report.changes.length}건)` : ' · 첫 기록'}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => patch(report.id, { published: !report.published })}
                    className={cn(
                      'rounded-lg border px-3 py-1 text-xs font-semibold',
                      report.published
                        ? 'border-gray-200 text-gray-600 hover:border-gray-400'
                        : 'border-transparent bg-gray-900 text-white',
                    )}
                  >
                    {report.published ? '내리기' : '발행하기'}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(report)}
                    aria-label="삭제"
                    className="ml-auto rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
