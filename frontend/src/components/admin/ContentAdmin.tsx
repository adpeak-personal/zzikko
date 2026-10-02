'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { ApiError, apiFetch } from '@/lib/api';
import { Thumb } from '@/components/ui';
import { cn, formatNumber } from '@/lib/utils';
import type { ChipTier, Chipset, NewsArticle, PhoneSpec } from '@/lib/types';

const THUMB_TONES = ['violet', 'rose', 'teal', 'amber', 'indigo', 'slate', 'zz'];

/* ── 새로 만들 때의 빈 값 (id 0 이면 아직 저장 전) ─── */

const emptyNews = (): NewsArticle => ({
  id: 0,
  title: '',
  category: '신제품',
  summary: '',
  body: '',
  thumb: 'violet',
  thumbUrl: null,
  author: '찍고 편집팀',
  date: new Date().toISOString().slice(0, 10),
  featured: false,
  published: true,
});

const emptySpec = (): PhoneSpec => ({
  id: 0,
  name: '',
  brand: 'Samsung',
  releaseDate: new Date().toISOString().slice(0, 7),
  retailPrice: 0,
  chipsetId: null,
  display: '',
  storage: '',
  battery: '',
  charging: '',
  cameraMain: '',
  cameraFront: '',
  weight: '',
  displayInch: 0,
  refreshHz: 0,
  memoryGb: 0,
  batteryMah: 0,
  chargingWatt: 0,
  cameraMainMp: 0,
  weightG: 0,
  thumb: 'violet',
  thumbUrl: null,
  published: true,
});

const emptyChipset = (): Chipset => ({
  id: 0,
  name: '',
  maker: 'Qualcomm',
  tier: '플래그십',
  year: new Date().getFullYear(),
});

/** 새 항목이면 POST, 기존 항목이면 PATCH */
function saveTo<T extends { id: number }>(base: string, item: T) {
  const path = item.id ? base + '/' + item.id : base;
  return apiFetch(path, { method: item.id ? 'PATCH' : 'POST', body: JSON.stringify(item) });
}

const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/* ── 공통 입력 요소 ──────────────────────────────── */

const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-zz-400';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

function ThumbPicker({ value, onChange }: { value: string; onChange: (tone: string) => void }) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {THUMB_TONES.map((tone) => (
        <button
          key={tone}
          type="button"
          onClick={() => onChange(tone)}
          aria-label={`${tone} 색`}
          aria-pressed={value === tone}
          className={cn('h-8 w-12 overflow-hidden rounded-md ring-offset-2', value === tone && 'ring-2 ring-zz-500')}
        >
          <Thumb tone={tone} className="h-full w-full" />
        </button>
      ))}
    </div>
  );
}

function FormActions({ onCancel, saving }: { onCancel: () => void; saving: boolean }) {
  return (
    <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
      <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600">
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
  );
}

/** 목록 행 오른쪽의 공개·수정·삭제 버튼 */
function RowActions({
  published,
  editing,
  publishLabels,
  onTogglePublish,
  onEdit,
  onDelete,
}: {
  published: boolean;
  editing: boolean;
  publishLabels: [on: string, off: string];
  onTogglePublish: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onTogglePublish}
        aria-label={published ? publishLabels[0] : publishLabels[1]}
        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
      >
        {published ? <Eye size={15} /> : <EyeOff size={15} />}
      </button>
      <button type="button" onClick={onEdit} aria-label="수정" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100">
        {editing ? <X size={15} /> : <Pencil size={15} />}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="삭제"
        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={15} />
      </button>
    </>
  );
}

/* ── IT 소식 ─────────────────────────────────────── */

const NEWS_CATEGORIES = ['신제품', '통신사', '요금제'];

function NewsForm({ draft, onDone }: { draft: NewsArticle; onDone: () => void }) {
  const [form, setForm] = useState(draft);
  const set = <K extends keyof NewsArticle>(key: K, value: NewsArticle[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return setError('제목을 입력해 주세요.');

    setSaving(true);
    setError(null);
    try {
      await saveTo('/admin/news', { ...form, title: form.title.trim(), summary: form.summary.trim() });
      onDone();
    } catch (err) {
      setError(message(err, '저장하지 못했습니다.'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_150px]">
        <Field label="제목">
          <input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={120} className={inputClass} />
        </Field>
        <Field label="말머리">
          <select value={form.category} onChange={(e) => set('category', e.target.value)} className={inputClass}>
            {NEWS_CATEGORIES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="발행일">
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} className={inputClass} />
        </Field>
      </div>

      <Field label="요약" hint="목록 카드에 두 줄까지 보입니다.">
        <input value={form.summary} onChange={(e) => set('summary', e.target.value)} maxLength={160} className={inputClass} />
      </Field>

      <Field label="본문">
        <textarea value={form.body} onChange={(e) => set('body', e.target.value)} rows={6} className={cn(inputClass, 'resize-y leading-relaxed')} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="작성자">
          <input value={form.author} onChange={(e) => set('author', e.target.value)} maxLength={30} className={inputClass} />
        </Field>
        <Field label="썸네일 색" hint="기사 이미지가 붙기 전까지 쓰는 색입니다.">
          <ThumbPicker value={form.thumb} onChange={(tone) => set('thumb', tone)} />
        </Field>
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} className="accent-zz-600" />
          발행 (끄면 사이트에서 숨김)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} className="accent-zz-600" />
          대표 기사 (맨 위 큰 카드)
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <FormActions onCancel={onDone} saving={saving} />
    </form>
  );
}

export function NewsAdmin({ articles }: { articles: NewsArticle[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<NewsArticle | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  const run = async (task: () => Promise<unknown>) => {
    setError(null);
    try {
      await task();
      router.refresh();
    } catch (err) {
      setError(message(err, '처리하지 못했습니다.'));
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
        <h2 className="text-sm font-bold text-gray-700">
          기사 <span className="font-normal text-gray-400">{articles.length}개</span>
        </h2>
        <button
          type="button"
          onClick={() => setEditing(emptyNews())}
          className="flex items-center gap-1 rounded-lg bg-zz-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zz-700"
        >
          <Plus size={14} /> 새 기사
        </button>
      </header>

      {editing && !editing.id && <NewsForm draft={editing} onDone={done} />}
      {error && <p className="border-b border-gray-100 bg-red-50 px-5 py-2 text-xs text-red-600">{error}</p>}

      <ul>
        {articles.map((article) => (
          <li key={article.id} className="border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-3 px-5 py-3">
              <Thumb tone={article.thumb} className="h-10 w-14 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-gray-900">{article.title}</span>
                  {article.featured && <Star size={12} className="shrink-0 text-amber-500" fill="currentColor" />}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-400">
                  {article.category} · {article.date} · {article.author}
                  {!article.published && <span className="rounded bg-amber-100 px-1.5 text-[10px] text-amber-800">미발행</span>}
                </p>
              </div>
              <RowActions
                published={article.published}
                editing={editing?.id === article.id}
                publishLabels={['숨기기', '발행하기']}
                onTogglePublish={() => run(() => saveTo('/admin/news', { ...article, published: !article.published }))}
                onEdit={() => setEditing(editing?.id === article.id ? null : article)}
                onDelete={() => {
                  if (!window.confirm(`'${article.title}' 기사를 지울까요?`)) return;
                  void run(() => apiFetch(`/admin/news/${article.id}`, { method: 'DELETE' }));
                }}
              />
            </div>

            {editing?.id === article.id && <NewsForm draft={editing} onDone={done} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── 스펙 비교 ───────────────────────────────────── */

/** 화면에 그대로 보여줄 문장 */
const SPEC_TEXT_FIELDS: { key: keyof PhoneSpec; label: string; placeholder: string }[] = [
  { key: 'display', label: '화면', placeholder: '6.2형 AMOLED · 120Hz' },
  { key: 'storage', label: '저장공간', placeholder: '256GB / 512GB' },
  { key: 'battery', label: '배터리', placeholder: '4000mAh' },
  { key: 'charging', label: '충전', placeholder: '유선 25W · 무선 15W' },
  { key: 'cameraMain', label: '후면 카메라', placeholder: '5000만 화소 (광각)' },
  { key: 'cameraFront', label: '전면 카메라', placeholder: '1200만 화소' },
  { key: 'weight', label: '무게', placeholder: '167g' },
];

/** 비교에만 쓰는 숫자 — 문장에서 긁어내면 표기가 조금만 달라져도 깨지므로 따로 받는다 */
const SPEC_NUMBER_FIELDS: { key: keyof PhoneSpec; label: string; unit: string; step?: number }[] = [
  { key: 'displayInch', label: '화면 크기', unit: '형', step: 0.1 },
  { key: 'refreshHz', label: '주사율', unit: 'Hz' },
  { key: 'memoryGb', label: '메모리', unit: 'GB' },
  { key: 'batteryMah', label: '배터리', unit: 'mAh' },
  { key: 'chargingWatt', label: '유선 충전', unit: 'W' },
  { key: 'cameraMainMp', label: '후면 카메라', unit: '만 화소' },
  { key: 'weightG', label: '무게', unit: 'g' },
];

function SpecForm({ draft, chipsets, onDone }: { draft: PhoneSpec; chipsets: Chipset[]; onDone: () => void }) {
  const [form, setForm] = useState(draft);
  const set = <K extends keyof PhoneSpec>(key: K, value: PhoneSpec[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return setError('기종 이름을 입력해 주세요.');

    setSaving(true);
    setError(null);
    try {
      await saveTo('/admin/specs', { ...form, name: form.name.trim() });
      onDone();
    } catch (err) {
      setError(message(err, '저장하지 못했습니다.'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_130px_130px_150px]">
        <Field label="기종 이름">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={40} className={inputClass} />
        </Field>
        <Field label="제조사">
          <select value={form.brand} onChange={(e) => set('brand', e.target.value as PhoneSpec['brand'])} className={inputClass}>
            <option>Samsung</option>
            <option>Apple</option>
            <option>기타</option>
          </select>
        </Field>
        <Field label="출시">
          <input type="month" value={form.releaseDate} onChange={(e) => set('releaseDate', e.target.value)} className={inputClass} />
        </Field>
        <Field label="출고가 (원)">
          <input
            type="number"
            min={0}
            step={1000}
            value={form.retailPrice}
            onChange={(e) => set('retailPrice', Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="칩셋" hint="목록에 없으면 아래 '칩셋 관리'에서 먼저 추가하세요.">
        <select
          value={form.chipsetId ?? ''}
          onChange={(e) => set('chipsetId', e.target.value ? Number(e.target.value) : null)}
          className={inputClass}
        >
          <option value="">선택 안 함</option>
          {chipsets.map((chipset) => (
            <option key={chipset.id} value={chipset.id}>
              {chipset.name} · {chipset.tier}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        {SPEC_TEXT_FIELDS.map((field) => (
          <Field key={field.key} label={field.label}>
            <input
              value={String(form[field.key] ?? '')}
              onChange={(e) => set(field.key, e.target.value as never)}
              placeholder={field.placeholder}
              className={inputClass}
            />
          </Field>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-medium text-gray-600">비교용 숫자</p>
        <p className="mt-0.5 text-[11px] text-gray-400">
          비교표에서 우세한 쪽을 표시할 때 씁니다. 비워두면(0) 그 항목은 비교하지 않습니다.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          {SPEC_NUMBER_FIELDS.map((field) => (
            <Field key={field.key} label={`${field.label} (${field.unit})`}>
              <input
                type="number"
                min={0}
                step={field.step ?? 1}
                value={Number(form[field.key] ?? 0)}
                onChange={(e) => set(field.key, Number(e.target.value) as never)}
                className={inputClass}
              />
            </Field>
          ))}
        </div>
      </div>

      <Field label="썸네일 색">
        <ThumbPicker value={form.thumb} onChange={(tone) => set('thumb', tone)} />
      </Field>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} className="accent-zz-600" />
        공개 (끄면 사이트에서 숨김)
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <FormActions onCancel={onDone} saving={saving} />
    </form>
  );
}

export function SpecAdmin({ specs, chipsets }: { specs: PhoneSpec[]; chipsets: Chipset[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PhoneSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  const run = async (task: () => Promise<unknown>) => {
    setError(null);
    try {
      await task();
      router.refresh();
    } catch (err) {
      setError(message(err, '처리하지 못했습니다.'));
    }
  };

  const chipsetName = (id: number | null) => chipsets.find((chipset) => chipset.id === id)?.name ?? '칩셋 미지정';

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
        <h2 className="text-sm font-bold text-gray-700">
          기종 <span className="font-normal text-gray-400">{specs.length}개</span>
        </h2>
        <button
          type="button"
          onClick={() => setEditing(emptySpec())}
          className="flex items-center gap-1 rounded-lg bg-zz-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zz-700"
        >
          <Plus size={14} /> 새 기종
        </button>
      </header>

      {editing && !editing.id && <SpecForm draft={editing} chipsets={chipsets} onDone={done} />}
      {error && <p className="border-b border-gray-100 bg-red-50 px-5 py-2 text-xs text-red-600">{error}</p>}

      <ul>
        {specs.map((spec) => (
          <li key={spec.id} className="border-b border-gray-100 last:border-0">
            <div className="flex items-center gap-3 px-5 py-3">
              <Thumb tone={spec.thumb} className="h-12 w-9 shrink-0 rounded" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900">{spec.name}</p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-400">
                  {spec.brand} · {chipsetName(spec.chipsetId)} · {formatNumber(spec.retailPrice)}원
                  {!spec.published && <span className="rounded bg-amber-100 px-1.5 text-[10px] text-amber-800">숨김</span>}
                </p>
              </div>
              <RowActions
                published={spec.published}
                editing={editing?.id === spec.id}
                publishLabels={['숨기기', '공개하기']}
                onTogglePublish={() => run(() => saveTo('/admin/specs', { ...spec, published: !spec.published }))}
                onEdit={() => setEditing(editing?.id === spec.id ? null : spec)}
                onDelete={() => {
                  if (!window.confirm(`'${spec.name}' 기종을 지울까요?`)) return;
                  void run(() => apiFetch(`/admin/specs/${spec.id}`, { method: 'DELETE' }));
                }}
              />
            </div>

            {editing?.id === spec.id && <SpecForm draft={editing} chipsets={chipsets} onDone={done} />}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── 칩셋 ────────────────────────────────────────── */

const TIERS: ChipTier[] = ['플래그십', '준플래그십', '중급', '보급형'];

const TIER_STYLE: Record<ChipTier, string> = {
  플래그십: 'bg-zz-50 text-zz-700',
  준플래그십: 'bg-indigo-50 text-indigo-700',
  중급: 'bg-gray-100 text-gray-600',
  보급형: 'bg-gray-100 text-gray-500',
};

export function TierBadge({ tier }: { tier: ChipTier }) {
  return <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold', TIER_STYLE[tier])}>{tier}</span>;
}

function ChipsetForm({ draft, onDone }: { draft: Chipset; onDone: () => void }) {
  const [form, setForm] = useState(draft);
  const set = <K extends keyof Chipset>(key: K, value: Chipset[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return setError('칩셋 이름을 입력해 주세요.');

    setSaving(true);
    setError(null);
    try {
      await saveTo('/admin/chipsets', { ...form, name: form.name.trim(), maker: form.maker.trim() });
      onDone();
    } catch (err) {
      setError(message(err, '저장하지 못했습니다.'));
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 border-t border-gray-100 bg-gray-50/70 px-5 py-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px_150px_110px]">
        <Field label="이름">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={40} placeholder="Snapdragon 8 Gen 5" className={inputClass} />
        </Field>
        <Field label="제조사">
          <input value={form.maker} onChange={(e) => set('maker', e.target.value)} maxLength={20} placeholder="Qualcomm" className={inputClass} />
        </Field>
        <Field label="등급" hint="같은 등급끼리는 서열을 매기지 않습니다.">
          <select value={form.tier} onChange={(e) => set('tier', e.target.value as ChipTier)} className={inputClass}>
            {TIERS.map((tier) => (
              <option key={tier}>{tier}</option>
            ))}
          </select>
        </Field>
        <Field label="출시 연도">
          <input type="number" min={2000} max={2100} value={form.year} onChange={(e) => set('year', Number(e.target.value))} className={inputClass} />
        </Field>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <FormActions onCancel={onDone} saving={saving} />
    </form>
  );
}

export function ChipsetAdmin({ chipsets, specs }: { chipsets: Chipset[]; specs: PhoneSpec[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Chipset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    setEditing(null);
    router.refresh();
  };

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-2.5">
        <div>
          <h2 className="text-sm font-bold text-gray-700">
            칩셋 <span className="font-normal text-gray-400">{chipsets.length}개</span>
          </h2>
          <p className="mt-0.5 text-[11px] text-gray-400">비교표에서는 등급으로만 우열을 표시합니다.</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(emptyChipset())}
          className="flex items-center gap-1 rounded-lg bg-zz-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-zz-700"
        >
          <Plus size={14} /> 새 칩셋
        </button>
      </header>

      {editing && !editing.id && <ChipsetForm draft={editing} onDone={done} />}

      {error && <p className="border-b border-gray-100 bg-red-50 px-5 py-2 text-xs text-red-600">{error}</p>}

      <ul>
        {chipsets.map((chipset) => {
          const used = specs.filter((spec) => spec.chipsetId === chipset.id).length;
          return (
            <li key={chipset.id} className="border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-gray-900">{chipset.name}</span>
                    <TierBadge tier={chipset.tier} />
                  </p>
                  <p className="mt-0.5 truncate text-xs text-gray-400">
                    {chipset.maker} · {chipset.year}년 · 사용 기종 {used}개
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(editing?.id === chipset.id ? null : chipset)}
                  aria-label="수정"
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"
                >
                  {editing?.id === chipset.id ? <X size={15} /> : <Pencil size={15} />}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setError(null);
                    if (!window.confirm(`'${chipset.name}' 칩셋을 지울까요?`)) return;
                    try {
                      await apiFetch(`/admin/chipsets/${chipset.id}`, { method: 'DELETE' });
                      router.refresh();
                    } catch (err) {
                      setError(message(err, '지우지 못했습니다.'));
                    }
                  }}
                  aria-label="삭제"
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {editing?.id === chipset.id && <ChipsetForm draft={editing} onDone={done} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
