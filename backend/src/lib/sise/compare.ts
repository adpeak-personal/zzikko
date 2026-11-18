import type { SiseChange, SiseRow } from '../../types.js';

/**
 * 같은 지역의 직전 시세표와 견준다.
 *
 * 값이 내려가면(delta 가 음수) 손님에게 유리해진 것이다 —
 * 할부원금이 줄었거나 페이백이 늘었거나 둘 중 하나인데, 부호 하나로 둘 다 표현된다.
 * (17 → 12 는 -5, -23 → -40 도 -17. 둘 다 "싸졌다")
 */

/** 같은 칸인지 가리는 열쇠. 요금제는 뺀다 — 이름이 자주 바뀌는데 자리는 그대로다. */
const keyOf = (row: SiseRow) => `${row.model}|${row.storage}|${row.carrier}|${row.joinType}`;

export interface SiseComparison {
  changes: SiseChange[];
  /** 싸진 칸 수 */
  cheaper: number;
  /** 비싸진 칸 수 */
  pricier: number;
  /** 그대로인 칸 수 */
  same: number;
  /** 이번에 새로 생긴 기종 (직전 표에 없던 것) */
  added: string[];
  /** 이번에 빠진 기종 */
  removed: string[];
}

export function compareSheets(current: SiseRow[], previous: SiseRow[]): SiseComparison {
  const before = new Map(previous.map((row) => [keyOf(row), row]));
  const changes: SiseChange[] = [];
  let cheaper = 0;
  let pricier = 0;
  let same = 0;

  for (const row of current) {
    const old = before.get(keyOf(row));
    if (!old) continue;

    const delta = row.price - old.price;
    if (delta < 0) cheaper++;
    else if (delta > 0) pricier++;
    else same++;

    if (delta !== 0) {
      changes.push({
        model: row.model,
        storage: row.storage,
        carrier: row.carrier,
        joinType: row.joinType,
        before: old.price,
        after: row.price,
        delta,
      });
    }
  }

  // 많이 움직인 순. 같으면 싸진 쪽을 앞에 둔다 — 읽는 사람이 먼저 보고 싶은 게 그쪽이다
  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.delta - b.delta);

  const modelsOf = (rows: SiseRow[]) => new Set(rows.map((row) => row.model));
  const now = modelsOf(current);
  const then = modelsOf(previous);

  return {
    changes,
    cheaper,
    pricier,
    same,
    added: [...now].filter((model) => !then.has(model)),
    removed: [...then].filter((model) => !now.has(model)),
  };
}

/** 기종별 최저가 — 글 머리에 "이번 주 제일 싼 조건" 으로 쓴다 */
export function lowestByModel(rows: SiseRow[]): SiseRow[] {
  const best = new Map<string, SiseRow>();
  for (const row of rows) {
    const key = `${row.model}|${row.storage}`;
    const kept = best.get(key);
    if (!kept || row.price < kept.price) best.set(key, row);
  }
  return [...best.values()].sort((a, b) => a.price - b.price);
}
