import type { ChipTier, Chipset, PhoneSpec } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

/**
 * 비교 규칙.
 * - higher/lower : 숫자가 크거나 작은 쪽이 낫다
 * - tier         : 칩셋 등급으로 비교 (같은 등급이면 '동급')
 * - neutral      : 우열은 없고 차이만 알려준다 (화면 크기처럼 취향이 갈리는 항목)
 * - none         : 비교하지 않는다
 */
export type CompareRule = 'higher' | 'lower' | 'tier' | 'neutral' | 'none';

export interface SpecRow {
  label: string;
  /** 화면에 보여줄 문자열 */
  text: (spec: PhoneSpec, chipsets: Chipset[]) => string;
  /** 비교에 쓸 숫자. 0 이나 없음이면 그 기종은 비교에서 빠진다 */
  value?: (spec: PhoneSpec, chipsets: Chipset[]) => number;
  rule: CompareRule;
  /** 차이 표기 — 예: (400) => '+400mAh' */
  diff?: (delta: number) => string;
  /** neutral 항목에서 큰 쪽/작은 쪽에 붙일 말 */
  neutralLabel?: [big: string, small: string];
}

/** 등급을 숫자로 — 비교에만 쓴다 */
export const TIER_RANK: Record<ChipTier, number> = {
  보급형: 1,
  중급: 2,
  준플래그십: 3,
  플래그십: 4,
};

export const findChipset = (chipsets: Chipset[], id: number | null) =>
  id === null ? undefined : chipsets.find((c) => c.id === id);

/**
 * 비교표와 상세 화면이 함께 쓰는 항목 정의.
 * 항목을 추가할 때 비교 규칙도 여기서 같이 정한다.
 */
export const SPEC_ROWS: SpecRow[] = [
  {
    label: '출고가',
    text: (s) => `${formatNumber(s.retailPrice)}원`,
    value: (s) => s.retailPrice,
    rule: 'lower',
    diff: (d) => `${formatNumber(d)}원 저렴`,
  },
  { label: '출시', text: (s) => s.releaseDate.replace('-', '.'), rule: 'none' },
  {
    label: '칩셋',
    text: (s, chipsets) => findChipset(chipsets, s.chipsetId)?.name ?? '미지정',
    value: (s, chipsets) => {
      const chipset = findChipset(chipsets, s.chipsetId);
      return chipset ? TIER_RANK[chipset.tier] : 0;
    },
    rule: 'tier',
  },
  {
    label: '화면 크기',
    text: (s) => s.display,
    value: (s) => s.displayInch,
    rule: 'neutral',
    neutralLabel: ['큰 화면', '작은 화면'],
  },
  {
    label: '주사율',
    text: (s) => (s.refreshHz ? `${s.refreshHz}Hz` : '—'),
    value: (s) => s.refreshHz,
    rule: 'higher',
    diff: (d) => `+${d}Hz`,
  },
  {
    label: '메모리',
    text: (s) => (s.memoryGb ? `${s.memoryGb}GB` : '—'),
    value: (s) => s.memoryGb,
    rule: 'higher',
    diff: (d) => `+${d}GB`,
  },
  { label: '저장공간', text: (s) => s.storage, rule: 'none' },
  {
    label: '배터리',
    text: (s) => s.battery,
    value: (s) => s.batteryMah,
    rule: 'higher',
    diff: (d) => `+${formatNumber(d)}mAh`,
  },
  {
    label: '충전',
    text: (s) => s.charging,
    value: (s) => s.chargingWatt,
    rule: 'higher',
    diff: (d) => `+${d}W`,
  },
  {
    label: '후면 카메라',
    text: (s) => s.cameraMain,
    value: (s) => s.cameraMainMp,
    rule: 'higher',
    diff: (d) => `+${formatNumber(d)}만 화소`,
  },
  { label: '전면 카메라', text: (s) => s.cameraFront, rule: 'none' },
  {
    label: '무게',
    text: (s) => s.weight,
    value: (s) => s.weightG,
    rule: 'lower',
    diff: (d) => `${d}g 가볍게`,
  },
];

export type CellMark =
  | { kind: 'best'; note?: string }
  | { kind: 'tie' }
  | { kind: 'neutral'; note: string }
  | null;

/**
 * 한 행에서 기종별 표시를 계산한다.
 *
 * - 값이 모두 같으면 아무 표시도 하지 않는다 (tier 는 '동급'만 알려준다)
 * - 세 대를 비교하면 1등에만 표시한다
 * - 차이값은 2등과의 차이로 적는다
 */
export function markRow(row: SpecRow, specs: PhoneSpec[], chipsets: Chipset[]): CellMark[] {
  if (row.rule === 'none' || !row.value) return specs.map(() => null);

  const values = specs.map((spec) => row.value!(spec, chipsets));
  // 값이 빠진 기종이 있으면 그 행은 비교하지 않는다
  if (values.some((v) => !v)) return specs.map(() => null);

  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === min) {
    return specs.map(() => (row.rule === 'tier' ? { kind: 'tie' as const } : null));
  }

  if (row.rule === 'neutral') {
    const [big, small] = row.neutralLabel ?? ['큰 쪽', '작은 쪽'];
    return values.map((v) =>
      v === max ? { kind: 'neutral' as const, note: big } : v === min ? { kind: 'neutral' as const, note: small } : null,
    );
  }

  const best = row.rule === 'lower' ? min : max;
  // 차이는 2등과 비교해서 적는다
  const runnerUp = row.rule === 'lower' ? Math.min(...values.filter((v) => v !== best)) : Math.max(...values.filter((v) => v !== best));
  const delta = Math.abs(best - runnerUp);

  return values.map((v) =>
    v === best ? { kind: 'best' as const, note: row.rule === 'tier' ? undefined : row.diff?.(delta) } : null,
  );
}
