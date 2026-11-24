'use client';

import { useMemo, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import type { MvnoPlan, PlanList } from '@/lib/types';
import { EmptyState, FilterChip, Tag } from '@/components/ui';
import { formatNumber } from '@/lib/utils';

/**
 * 유심 요금제 목록 — 거르기·정렬은 브라우저에서 한다(전부 해도 200개 안팎).
 *
 * 요금은 **포인트를 빼지 않은 월 납부액**이다. 포인트를 뺀 '체감가' 를 큰 글씨로 쓰면
 * 0원 요금제처럼 보이는데, 실제로 매달 빠져나가는 돈은 그게 아니다. 포인트는 혜택 칸에 적는다.
 */

const NETWORKS = ['SKT', 'KT', 'LG U+'] as const;

/** 하루 데이터는 한 달 30일로 쳐서 더한다. 무제한은 맨 위 */
const monthlyData = (plan: MvnoPlan) =>
  plan.unlimited ? Number.POSITIVE_INFINITY : (plan.dataGb ?? 0) + (plan.dailyGb ?? 0) * 30;

const DATA_RANGES = [
  { key: 'u7', label: '7GB 이하', test: (gb: number) => gb <= 7 },
  { key: '8-15', label: '8~15GB', test: (gb: number) => gb >= 8 && gb <= 15 },
  { key: '16-50', label: '16~50GB', test: (gb: number) => gb > 15 && gb <= 50 },
  { key: '51-99', label: '51~99GB', test: (gb: number) => gb > 50 && gb < 100 },
  { key: '100', label: '100GB 이상', test: (gb: number) => gb >= 100 && Number.isFinite(gb) },
  { key: 'inf', label: '무제한', test: (gb: number) => !Number.isFinite(gb) },
] as const;

const PRICE_RANGES = [
  { key: 'u10', label: '1만원 미만', test: (won: number) => won < 10_000 },
  { key: '10-20', label: '1~2만원', test: (won: number) => won >= 10_000 && won < 20_000 },
  { key: '20-30', label: '2~3만원', test: (won: number) => won >= 20_000 && won < 30_000 },
  { key: '30', label: '3만원 이상', test: (won: number) => won >= 30_000 },
] as const;

const SORTS = {
  fee: { label: '지금 요금 낮은 순', compare: (a: MvnoPlan, b: MvnoPlan) => a.monthlyFee - b.monthlyFee },
  after: {
    label: '할인 끝난 뒤 낮은 순',
    compare: (a: MvnoPlan, b: MvnoPlan) => (a.feeAfterPromo ?? a.monthlyFee) - (b.feeAfterPromo ?? b.monthlyFee),
  },
  data: { label: '데이터 많은 순', compare: (a: MvnoPlan, b: MvnoPlan) => monthlyData(b) - monthlyData(a) },
} as const;
type SortKey = keyof typeof SORTS;

const PAGE = 20;

function formatSynced(value: string | null) {
  if (!value) return '';
  const [date = '', time = ''] = value.split(' ');
  return `${date.replaceAll('-', '.')} ${time.slice(0, 5)}`;
}

export function PlanBoard({ data }: { data: PlanList }) {
  const [network, setNetwork] = useState<string | null>(null);
  const [dataRange, setDataRange] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('fee');
  const [limit, setLimit] = useState(PAGE);

  const shown = useMemo(() => {
    const dataTest = DATA_RANGES.find((range) => range.key === dataRange)?.test;
    const priceTest = PRICE_RANGES.find((range) => range.key === priceRange)?.test;
    return data.items
      .filter((plan) => !network || plan.network === network)
      .filter((plan) => !dataTest || dataTest(monthlyData(plan)))
      .filter((plan) => !priceTest || priceTest(plan.monthlyFee))
      .sort(SORTS[sort].compare);
  }, [data.items, network, dataRange, priceRange, sort]);

  /** 거르는 조건을 바꾸면 처음 20개부터 다시 보여준다 */
  const pick = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setLimit(PAGE);
  };

  return (
    <div>
      <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        <ChipRow label="망" value={network} onChange={pick(setNetwork)} options={NETWORKS.map((item) => [item, item])} />
        <ChipRow
          label="데이터"
          value={dataRange}
          onChange={pick(setDataRange)}
          options={DATA_RANGES.map((range) => [range.key, range.label])}
        />
        <ChipRow
          label="월 요금"
          value={priceRange}
          onChange={pick(setPriceRange)}
          options={PRICE_RANGES.map((range) => [range.key, range.label])}
        />
      </div>

      <div className="mt-4 mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">
          요금제 <b className="text-gray-900">{shown.length}</b>개
        </p>
        <select
          value={sort}
          onChange={(e) => pick(setSort)(e.target.value as SortKey)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-600"
          aria-label="정렬"
        >
          {Object.entries(SORTS).map(([key, item]) => (
            <option key={key} value={key}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      {shown.length > 0 ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.slice(0, limit).map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </ul>
      ) : (
        <EmptyState>
          {data.items.length === 0 ? '아직 등록된 요금제가 없습니다.' : '조건에 맞는 요금제가 없습니다.'}
        </EmptyState>
      )}

      {shown.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((prev) => prev + PAGE)}
          className="mt-4 w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          더 보기 ({formatNumber(shown.length - limit)}개 남음)
        </button>
      )}

      {/* 출처 — 남의 목록에서 받아 온 자료라 어디서 왔는지와 기준 시각을 밝힌다 */}
      <p className="mt-5 text-xs leading-relaxed text-gray-400">
        요금제 자료:{' '}
        <a href={data.source.home} target="_blank" rel="nofollow noopener noreferrer" className="underline">
          {data.source.name}
        </a>
        {data.syncedAt && ` · ${formatSynced(data.syncedAt)} 기준`}. 요금과 혜택은 수시로 바뀌니 가입 전에 안내 페이지에서
        꼭 확인하세요.
      </p>
    </div>
  );
}

function ChipRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: (readonly [string, string])[];
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-12 shrink-0 text-xs font-semibold text-gray-500">{label}</span>
      <div className="scrollbar-none flex min-w-0 gap-1.5 overflow-x-auto">
        <FilterChip href="#" active={!value} onClick={() => onChange(null)}>
          전체
        </FilterChip>
        {options.map(([key, text]) => (
          <FilterChip key={key} href="#" active={value === key} onClick={() => onChange(key)}>
            {text}
          </FilterChip>
        ))}
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: MvnoPlan }) {
  const isMvno = plan.carrier !== plan.network;
  // 알뜰폰 카드의 혜택 문장은 "12개월 후 55,000원" 처럼 위 요금과 겹치므로 뺀다
  const perks = [...(plan.benefit && plan.feeAfterPromo == null ? [plan.benefit] : []), ...plan.perks];
  return (
    <li className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Tag tone="dark">{plan.network}</Tag>
        {plan.tech && <Tag>{plan.tech}</Tag>}
        {isMvno && <span className="text-xs text-gray-500">{plan.carrier}</span>}
      </div>
      <h3 className="mt-1.5 font-bold text-gray-900">{plan.name}</h3>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-extrabold text-gray-900">{plan.dataText}</p>
          <p className="truncate text-xs text-gray-500">
            {[plan.afterSpeed, plan.voice && `통화 ${plan.voice}`, plan.sms && `문자 ${plan.sms}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-gray-400">{plan.promoMonths ? `${plan.promoMonths}개월간` : '월'}</p>
          <p className="text-lg font-extrabold text-zz-600">{formatNumber(plan.monthlyFee)}원</p>
          {plan.feeAfterPromo != null && (
            <p className="text-xs text-gray-500">이후 {formatNumber(plan.feeAfterPromo)}원</p>
          )}
        </div>
      </div>

      {perks.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg bg-zz-50 px-3 py-2 text-xs text-zz-700">
          {perks.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ul>
      )}

      {plan.conditions.length > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-gray-500">{plan.conditions.join(' · ')}</p>
      )}

      <div className="mt-auto pt-3">
        <a
          href={plan.sourceUrl}
          target="_blank"
          rel="nofollow noopener noreferrer"
          className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          가입 안내 보기 <ExternalLink size={13} />
        </a>
      </div>
    </li>
  );
}
