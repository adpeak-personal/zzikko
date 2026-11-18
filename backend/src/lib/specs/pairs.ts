import type { PhoneSpec } from '../../types.js';

/**
 * 비교 페이지로 만들 기종 짝을 고른다.
 *
 * **전부 만들면 안 된다.** 기종이 20개면 조합이 190개인데, 그중 대부분은
 * 아무도 찾지 않는다("갤럭시 S26 vs 아이폰17e"). 검색 수요가 없는 페이지를
 * 수백 개 찍어내면 구글이 대량 생성 콘텐츠로 본다.
 *
 * 사람이 실제로 견주는 세 가지만 만든다:
 *   1. 같은 시기 다른 브랜드 주력끼리  (갤럭시 S26 vs 아이폰 18 Pro)
 *   2. 같은 브랜드 앞뒤 세대          (갤럭시 S25 vs S26)
 *   3. 같은 브랜드 같은 세대 등급 차이 (갤럭시 S26 vs S26 울트라)
 */

export interface SpecPair {
  a: PhoneSpec;
  b: PhoneSpec;
  /** 왜 이 둘을 붙였는지 — 글 머리에 쓴다 */
  reason: '타사 경쟁' | '세대 비교' | '등급 비교';
}

/** 'YYYY-MM' → 개월 수. 비교하기 쉽게 숫자로 편다. */
function months(releaseDate: string): number {
  const [year, month] = releaseDate.split('-').map(Number);
  if (!year || !month) return 0;
  return year * 12 + month;
}

/**
 * 기종 이름에서 등급과 계열을 떼어낸다.
 * "갤럭시 S26 울트라" → { family: '갤럭시 S26', rank: 3 }
 */
const GRADES: [pattern: RegExp, rank: number][] = [
  [/울트라|ultra|프로\s*맥스|pro\s*max|max\b/i, 3],
  [/프로|pro\b/i, 2],
  [/플러스|plus|\+/i, 1],
];

function grade(name: string): { family: string; rank: number } {
  for (const [pattern, rank] of GRADES) {
    if (pattern.test(name)) return { family: name.replace(pattern, '').replace(/\s+/g, ' ').trim(), rank };
  }
  return { family: name.trim(), rank: 0 };
}

/** 같은 계열의 세대 숫자 — "갤럭시 S26" → 26 */
function generation(family: string): number | null {
  const match = family.match(/(\d{1,3})\s*(e|FE)?$/i);
  return match?.[1] ? Number(match[1]) : null;
}

/** 계열 이름에서 숫자를 뗀 것 — 세대 비교용 열쇠 */
const line = (family: string) => family.replace(/\d{1,3}\s*(e|FE)?$/i, '').trim();

/** 접는 폰과 바형을 섞지 않는다 — 쓰임이 달라 견줄 대상이 아니다 */
const isFoldable = (name: string) => /폴더블|폴드|플립|fold|flip/i.test(name);

/**
 * 가격대가 비슷한지.
 *
 * 등급 이름만으로는 모자란다 — "갤럭시 S26"과 "아이폰 17e"는 둘 다 등급 표시가 없지만
 * 하나는 115만원 플래그십, 하나는 89만원 보급형이라 견줄 대상이 아니다.
 * 실제로 같이 놓고 고민하는 건 값이 비슷한 기종들이다.
 */
function samePriceBand(a: number, b: number): boolean {
  if (!a || !b) return false;
  return Math.abs(a - b) / Math.max(a, b) <= 0.2;
}

export function buildPairs(specs: PhoneSpec[]): SpecPair[] {
  const live = specs.filter((spec) => spec.releaseDate && spec.retailPrice > 0);
  const pairs = new Map<string, SpecPair>();

  const add = (a: PhoneSpec, b: PhoneSpec, reason: SpecPair['reason']) => {
    // 같은 짝을 순서만 바꿔 두 번 담지 않는다
    const [first, second] = a.id < b.id ? [a, b] : [b, a];
    const key = `${first.id}-${second.id}`;
    if (!pairs.has(key)) pairs.set(key, { a: first, b: second, reason });
  };

  for (const a of live) {
    const ga = grade(a.name);
    for (const b of live) {
      if (a.id >= b.id) continue;
      const gb = grade(b.name);

      // 1) 타사 경쟁 — 같은 폼팩터·같은 등급·비슷한 값·비슷한 시기.
      //    네 가지를 다 봐야 한다. 하나라도 빼면 폴더블과 바형이 붙거나
      //    플래그십과 보급형이 붙는다.
      if (a.brand !== b.brand && a.brand !== '기타' && b.brand !== '기타') {
        const gap = Math.abs(months(a.releaseDate) - months(b.releaseDate));
        // 삼성은 2월, 애플은 9월에 내놓으므로 반년을 조금 넘겨 잡는다
        if (
          gap <= 9 &&
          ga.rank === gb.rank &&
          isFoldable(a.name) === isFoldable(b.name) &&
          samePriceBand(a.retailPrice, b.retailPrice)
        ) {
          add(a, b, '타사 경쟁');
        }
        continue;
      }

      if (a.brand !== b.brand) continue;

      const genA = generation(ga.family);
      const genB = generation(gb.family);

      // 2) 세대 비교 — 같은 계열, 같은 등급, 바로 앞뒤 세대
      if (
        genA !== null &&
        genB !== null &&
        ga.rank === gb.rank &&
        line(ga.family) === line(gb.family) &&
        Math.abs(genA - genB) === 1
      ) {
        add(a, b, '세대 비교');
        continue;
      }

      // 3) 등급 비교 — 같은 계열, 같은 세대, 등급만 다름
      if (ga.family === gb.family && ga.rank !== gb.rank) add(a, b, '등급 비교');
    }
  }

  return [...pairs.values()];
}

/** 주소에 쓸 조각. 한글 기종명은 그대로 둔다 — 검색에 그대로 걸린다. */
export function pairSlug(a: PhoneSpec, b: PhoneSpec): string {
  const piece = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .replace(/[^\w가-힣]+/g, '-')
      .replace(/^-+|-+$/g, '');
  // 늘 같은 순서로 — id 순으로 고정해야 주소가 하나로 정해진다
  const [first, second] = a.id < b.id ? [a, b] : [b, a];
  return `${piece(first.name)}-vs-${piece(second.name)}`;
}
