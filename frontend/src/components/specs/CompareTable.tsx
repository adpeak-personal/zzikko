'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Scale, X } from 'lucide-react';
import type { Chipset, PhoneSpec } from '@/lib/types';
import { Thumb } from '@/components/ui';
import { cn } from '@/lib/utils';
import { SPEC_ROWS, findChipset, markRow } from './spec-rows';

/**
 * 고른 기종 나란히 비교.
 *
 * 우세한 쪽은 **색만으로 구분하지 않는다** — 옅은 배경 + 굵은 글씨 + 체크 아이콘을 함께 쓴다.
 * 값이 같으면 아무 표시도 하지 않고, 셋을 비교하면 1등에만 표시한다.
 */
export function CompareTable({
  specs,
  chipsets,
  max,
  onRemove,
  onClear,
}: {
  specs: PhoneSpec[];
  chipsets: Chipset[];
  max: number;
  onRemove: (id: number) => void;
  onClear: () => void;
}) {
  const [onlyDiff, setOnlyDiff] = useState(false);

  const rows = SPEC_ROWS.map((row) => ({ row, marks: markRow(row, specs, chipsets) }));
  const shown = onlyDiff ? rows.filter(({ marks }) => marks.some((mark) => mark?.kind === 'best' || mark?.kind === 'neutral')) : rows;

  return (
    <section className="mb-6 overflow-hidden rounded-xl border border-zz-200 bg-white">
      <header className="flex flex-wrap items-center gap-2 bg-zz-50 px-5 py-3">
        <Scale size={16} className="text-zz-600" />
        <h2 className="font-bold text-gray-900">기종 비교</h2>
        <span className="text-xs text-gray-500">
          {specs.length} / {max}
        </span>

        {specs.length > 1 && (
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="accent-zz-600" />
            차이 나는 항목만
          </label>
        )}
        <button
          type="button"
          onClick={onClear}
          className={cn('rounded-lg px-2.5 py-1 text-xs text-gray-500 hover:bg-white', specs.length <= 1 && 'ml-auto')}
        >
          모두 해제
        </button>
      </header>

      {specs.length === 1 ? (
        <p className="px-5 py-6 text-center text-sm text-gray-500">기종을 하나 더 고르면 나란히 비교합니다.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="w-24 px-4 py-3 text-left text-xs font-medium text-gray-500">항목</th>
                  {specs.map((spec) => (
                    <th key={spec.id} className="px-4 py-3 text-left">
                      <span className="flex items-center gap-2">
                        <Thumb tone={spec.thumb} className="h-10 w-8 shrink-0 rounded" />
                        <span className="min-w-0">
                          <Link href={`/board/specs/${spec.id}`} className="block truncate font-bold text-gray-900 hover:underline">
                            {spec.name}
                          </Link>
                          <span className="block text-[11px] font-normal text-gray-400">{spec.brand}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemove(spec.id)}
                          aria-label={`${spec.name} 비교에서 빼기`}
                          className="ml-auto rounded p-1 text-gray-300 hover:bg-gray-100 hover:text-gray-600"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map(({ row, marks }) => (
                  <tr key={row.label} className="border-b border-gray-100 last:border-0">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{row.label}</th>
                    {specs.map((spec, index) => {
                      const mark = marks[index];
                      const chipset = row.label === '칩셋' ? findChipset(chipsets, spec.chipsetId) : undefined;
                      return (
                        <td
                          key={spec.id}
                          className={cn('px-4 py-2.5 align-top', mark?.kind === 'best' && 'bg-zz-50/70')}
                        >
                          <span className={cn('flex items-center gap-1', mark?.kind === 'best' ? 'font-bold text-gray-900' : 'text-gray-700')}>
                            {mark?.kind === 'best' && <Check size={13} className="shrink-0 text-zz-600" />}
                            {row.text(spec, chipsets)}
                          </span>

                          {/* 칩셋은 등급을, 나머지는 2등과의 차이를 덧붙인다 */}
                          {chipset && (
                            <span className="mt-0.5 block text-[11px] text-gray-500">
                              {chipset.tier}
                              {mark?.kind === 'tie' && ' · 동급'}
                            </span>
                          )}
                          {mark?.kind === 'best' && mark.note && (
                            <span className="mt-0.5 block text-[11px] font-semibold text-zz-600">{mark.note}</span>
                          )}
                          {mark?.kind === 'neutral' && (
                            <span className="mt-0.5 block text-[11px] text-gray-400">{mark.note}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {shown.length === 0 && <p className="px-5 py-6 text-center text-sm text-gray-500">차이 나는 항목이 없습니다.</p>}

          <p className="border-t border-gray-100 bg-gray-50 px-5 py-3 text-xs leading-relaxed text-gray-500">
            항목별 수치를 기계적으로 비교한 결과입니다. 칩셋은 등급으로만 비교하며 같은 등급 안에서는 서열을 매기지 않습니다.
            실제 체감 성능은 기기 설계에 따라 달라질 수 있습니다.
          </p>
        </>
      )}
    </section>
  );
}
