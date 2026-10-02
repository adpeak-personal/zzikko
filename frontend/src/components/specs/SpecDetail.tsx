import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import type { Chipset, PhoneSpec } from '@/lib/types';
import { Card, Thumb } from '@/components/ui';
import { formatNumber } from '@/lib/utils';
import { SPEC_ROWS, findChipset } from './spec-rows';

/** 기종 상세 — 사양 한 장 */
export function SpecDetail({
  spec,
  chipsets,
  others,
}: {
  spec: PhoneSpec;
  chipsets: Chipset[];
  others: PhoneSpec[];
}) {
  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-sm font-medium text-gray-400" aria-label="현재 위치">
        <Link href="/board/specs" className="hover:text-gray-700">
          스펙 비교
        </Link>
        <ChevronRight size={14} />
        <span className="text-gray-600">{spec.name}</span>
      </nav>

      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-5">
          <Thumb tone={spec.thumb} className="h-32 w-24 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-400">{spec.brand}</p>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-gray-900">{spec.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{spec.releaseDate.replace('-', '.')} 출시</p>
            <p className="mt-3 text-xl font-extrabold text-zz-600">{formatNumber(spec.retailPrice)}원</p>
          </div>
          <Link
            href={`/board/deals?q=${encodeURIComponent(spec.name)}`}
            className="rounded-xl bg-zz-600 px-5 py-3 font-bold text-white hover:bg-zz-700"
          >
            이 기종 시세 보기
          </Link>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <h2 className="border-b border-gray-100 px-5 py-3.5 text-base font-bold text-gray-900">상세 사양</h2>
        <dl className="divide-y divide-gray-100">
          {SPEC_ROWS.map((row) => (
            <div key={row.label} className="flex gap-4 px-5 py-3 text-sm">
              <dt className="w-24 shrink-0 font-medium text-gray-500">{row.label}</dt>
              <dd className="text-gray-800">
                {row.text(spec, chipsets)}
                {row.label === '칩셋' && findChipset(chipsets, spec.chipsetId) && (
                  <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    {findChipset(chipsets, spec.chipsetId)!.tier}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
        <p className="bg-gray-50 px-5 py-3 text-xs text-gray-500">예시 데이터입니다. 실제 사양·가격과 다를 수 있습니다.</p>
      </Card>

      {others.length > 0 && (
        <Card>
          <h2 className="border-b border-gray-100 px-5 py-3.5 text-base font-bold text-gray-900">다른 기종</h2>
          <ul className="grid gap-px bg-gray-100 sm:grid-cols-2">
            {others.map((item) => (
              <li key={item.id} className="bg-white">
                <Link href={`/board/specs/${item.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <Thumb tone={item.thumb} className="h-12 w-9 shrink-0 rounded" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-gray-900">{item.name}</span>
                    <span className="block text-xs text-gray-400">{formatNumber(item.retailPrice)}원</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Link href="/board/specs" className="flex w-fit items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-5 py-2.5 font-bold text-gray-700 hover:border-gray-300">
        <ArrowLeft size={16} /> 목록
      </Link>
    </div>
  );
}
