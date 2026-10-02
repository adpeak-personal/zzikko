'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Scale, X } from 'lucide-react';
import type { Chipset, PhoneSpec } from '@/lib/types';
import { EmptyState, FilterChip, Thumb } from '@/components/ui';
import { formatNumber } from '@/lib/utils';
import { CompareTable } from './CompareTable';
import { findChipset } from './spec-rows';

const BRANDS = ['Samsung', 'Apple', '기타'] as const;
const MAX_COMPARE = 3;

/** 기종 카드 목록 + 고른 기종 나란히 비교 */
export function SpecBoard({ specs, chipsets }: { specs: PhoneSpec[]; chipsets: Chipset[] }) {
  const [brand, setBrand] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);

  const shown = brand ? specs.filter((s) => s.brand === brand) : specs;
  const compare = picked.map((id) => specs.find((s) => s.id === id)).filter((s) => s !== undefined);

  const toggle = (id: number) =>
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((v) => v !== id);
      if (prev.length >= MAX_COMPARE) return prev; // 최대 3개까지만
      return [...prev, id];
    });

  return (
    <div>
      <div className="scrollbar-none mb-5 flex gap-2 overflow-x-auto">
        <FilterChip href="#" active={!brand} onClick={() => setBrand(null)}>
          전체
        </FilterChip>
        {BRANDS.map((item) => (
          <FilterChip key={item} href="#" active={brand === item} onClick={() => setBrand(item)}>
            {item}
          </FilterChip>
        ))}
      </div>

      {compare.length > 0 && (
        <CompareTable
          specs={compare}
          chipsets={chipsets}
          max={MAX_COMPARE}
          onRemove={toggle}
          onClear={() => setPicked([])}
        />
      )}

      {/* 기종 목록 */}
      {shown.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((spec) => {
            const checked = picked.includes(spec.id);
            return (
              <li key={spec.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex gap-3">
                  <Thumb tone={spec.thumb} className="h-20 w-16 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/board/specs/${spec.id}`} className="block truncate font-bold text-gray-900 hover:underline">
                      {spec.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {spec.brand} · {spec.releaseDate.replace('-', '.')} 출시
                    </p>
                    <p className="mt-1.5 text-sm font-bold text-zz-600">{formatNumber(spec.retailPrice)}원</p>
                  </div>
                </div>

                <dl className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0">화면</dt>
                    <dd className="truncate text-gray-700">{spec.display}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0">칩셋</dt>
                    <dd className="truncate text-gray-700">
                      {findChipset(chipsets, spec.chipsetId)?.name ?? '미지정'}
                      {findChipset(chipsets, spec.chipsetId) && (
                        <span className="ml-1 text-gray-400">· {findChipset(chipsets, spec.chipsetId)!.tier}</span>
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-12 shrink-0">배터리</dt>
                    <dd className="truncate text-gray-700">{spec.battery}</dd>
                  </div>
                </dl>

                <label
                  className={`mt-3 flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-semibold transition ${
                    checked ? 'border-zz-600 bg-zz-50 text-zz-700' : 'border-gray-200 text-gray-600 hover:border-zz-300'
                  }`}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(spec.id)} className="sr-only" />
                  <Scale size={14} />
                  {checked ? '비교 중' : '비교에 추가'}
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState>등록된 기종이 없습니다.</EmptyState>
        </div>
      )}
    </div>
  );
}
