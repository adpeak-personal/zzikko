import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { query, queryOne, withTransaction } from '../db/pool.js';
import type { MvnoPlan } from '../types.js';

/**
 * 유심 요금제 저장소 (`mvno_plans`).
 *
 * 회원 글이 아니라 바깥 목록에서 받아 오는 자료다. 받아 올 때마다 **덮어쓰고**,
 * 이번에 목록에 없던 요금제는 지우지 않고 `active = 0` 으로 내린다 —
 * 판매가 끝났다가 다시 나오는 요금제가 흔하고, 그때 같은 행으로 돌아와야 해서다.
 */

/** 가져오기가 만드는 모양 — DB 칸과 1:1 */
export interface PlanInput {
  sourceId: string;
  carrier: string;
  network: string;
  tech: string;
  name: string;
  tags: string[];
  dataText: string;
  dataGb: number | null;
  dailyGb: number | null;
  unlimited: boolean;
  afterSpeed: string;
  voice: string;
  sms: string;
  monthlyFee: number;
  promoMonths: number | null;
  feeAfterPromo: number | null;
  regularFee: number | null;
  benefit: string;
  perks: string[];
  conditions: string[];
  sourceUrl: string;
}

interface PlanRow extends RowDataPacket {
  id: number;
  source: string;
  source_id: string;
  carrier: string;
  network: string;
  tech: string;
  name: string;
  tags: string[] | string | null;
  data_text: string;
  data_gb: string | number | null;
  daily_gb: string | number | null;
  unlimited: number;
  after_speed: string;
  voice: string;
  sms: string;
  monthly_fee: number;
  promo_months: number | null;
  fee_after_promo: number | null;
  regular_fee: number | null;
  benefit: string;
  perks: string[] | string | null;
  conditions: string[] | string | null;
  source_url: string;
  last_seen_at: string;
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const num = (value: string | number | null) => (value == null ? null : Number(value));

const toPlan = (row: PlanRow): MvnoPlan => ({
  id: row.id,
  carrier: row.carrier,
  network: row.network,
  tech: row.tech,
  name: row.name,
  tags: list(row.tags),
  dataText: row.data_text,
  dataGb: num(row.data_gb),
  dailyGb: num(row.daily_gb),
  unlimited: row.unlimited === 1,
  afterSpeed: row.after_speed,
  voice: row.voice,
  sms: row.sms,
  monthlyFee: row.monthly_fee,
  promoMonths: row.promo_months,
  feeAfterPromo: row.fee_after_promo,
  regularFee: row.regular_fee,
  benefit: row.benefit,
  perks: list(row.perks),
  conditions: list(row.conditions),
  sourceUrl: row.source_url,
  updatedAt: row.last_seen_at,
});

/** 공개 목록 — 지금 파는 것만, 월 요금 낮은 순 */
export async function listPlans(): Promise<MvnoPlan[]> {
  const rows = await query<PlanRow>(
    `SELECT * FROM mvno_plans WHERE active = 1 ORDER BY monthly_fee, id`,
  );
  return rows.map(toPlan);
}

/** 마지막으로 받아 온 시각 (없으면 null) */
export async function lastSyncedAt(source: string): Promise<string | null> {
  const row = await queryOne<RowDataPacket & { at: string | null }>(
    `SELECT MAX(last_seen_at) AS at FROM mvno_plans WHERE source = ?`,
    [source],
  );
  return row?.at ?? null;
}

const cut = (value: string, max: number) => value.slice(0, max);

/**
 * 받아 온 목록으로 갈아끼운다. 한 트랜잭션이라 중간에 실패하면 그대로 남는다.
 *
 * ⚠️ 빈 목록으로 부르지 말 것 — 전부 `active = 0` 이 된다. 호출하는 쪽에서 막는다.
 */
export async function syncPlans(
  source: string,
  plans: PlanInput[],
): Promise<{ added: number; updated: number; ended: number; total: number }> {
  if (plans.length === 0) throw new Error('받아 온 요금제가 없습니다.');

  return withTransaction(async (conn) => {
    const [existing] = await conn.query<RowDataPacket[]>(
      `SELECT source_id FROM mvno_plans WHERE source = ?`,
      [source],
    );
    const known = new Set(existing.map((row) => String(row.source_id)));

    let added = 0;
    for (const plan of plans) {
      if (!known.has(plan.sourceId)) added += 1;
      await conn.query(
        `INSERT INTO mvno_plans
           (source, source_id, carrier, network, tech, name, tags, data_text, data_gb, daily_gb, unlimited,
            after_speed, voice, sms, monthly_fee, promo_months, fee_after_promo, regular_fee,
            benefit, perks, conditions, source_url, active, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           carrier = VALUES(carrier), network = VALUES(network), tech = VALUES(tech), name = VALUES(name),
           tags = VALUES(tags), data_text = VALUES(data_text), data_gb = VALUES(data_gb),
           daily_gb = VALUES(daily_gb), unlimited = VALUES(unlimited), after_speed = VALUES(after_speed),
           voice = VALUES(voice), sms = VALUES(sms), monthly_fee = VALUES(monthly_fee),
           promo_months = VALUES(promo_months), fee_after_promo = VALUES(fee_after_promo),
           regular_fee = VALUES(regular_fee), benefit = VALUES(benefit), perks = VALUES(perks),
           conditions = VALUES(conditions), source_url = VALUES(source_url),
           active = 1, last_seen_at = NOW()`,
        [
          source,
          cut(plan.sourceId, 80),
          cut(plan.carrier, 40),
          cut(plan.network, 10),
          cut(plan.tech, 10),
          cut(plan.name, 120),
          JSON.stringify(plan.tags),
          cut(plan.dataText, 40),
          plan.dataGb,
          plan.dailyGb,
          plan.unlimited ? 1 : 0,
          cut(plan.afterSpeed, 60),
          cut(plan.voice, 20),
          cut(plan.sms, 20),
          plan.monthlyFee,
          plan.promoMonths,
          plan.feeAfterPromo,
          plan.regularFee,
          cut(plan.benefit, 300),
          JSON.stringify(plan.perks),
          JSON.stringify(plan.conditions),
          cut(plan.sourceUrl, 300),
        ],
      );
    }

    // 이번 목록에 없던 것은 판매 종료로 내린다
    const [ended] = await conn.query<ResultSetHeader>(
      `UPDATE mvno_plans SET active = 0 WHERE source = ? AND active = 1 AND source_id NOT IN (?)`,
      [source, plans.map((plan) => plan.sourceId)],
    );

    return { added, updated: plans.length - added, ended: ended.affectedRows, total: plans.length };
  });
}
