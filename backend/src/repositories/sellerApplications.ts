import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import type { SellerApplication, SellerApplicationStatus } from '../types.js';

interface Row extends RowDataPacket {
  id: number;
  shop_name: string;
  manager: string;
  phone: string;
  region: string;
  area: string | null;
  carriers: unknown;
  channel: string | null;
  message: string | null;
  status: SellerApplicationStatus;
  memo: string | null;
  created_at: string;
}

/** JSON 컬럼은 드라이버 설정에 따라 배열로 올 때도, 문자열로 올 때도 있다 */
function toCarriers(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const toApplication = (row: Row): SellerApplication => ({
  id: row.id,
  shopName: row.shop_name,
  manager: row.manager,
  phone: row.phone,
  region: row.region,
  area: row.area,
  carriers: toCarriers(row.carriers),
  channel: row.channel,
  message: row.message,
  status: row.status,
  memo: row.memo,
  createdAt: row.created_at,
});

export interface NewApplication {
  shopName: string;
  manager: string;
  phone: string;
  region: string;
  area?: string;
  carriers?: string[];
  channel?: string;
  message?: string;
}

export async function createApplication(input: NewApplication): Promise<number> {
  const result = await execute(
    `INSERT INTO seller_applications (shop_name, manager, phone, region, area, carriers, channel, message)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.shopName,
      input.manager,
      input.phone,
      input.region,
      input.area ?? null,
      JSON.stringify(input.carriers ?? []),
      input.channel ?? null,
      input.message ?? null,
    ],
  );
  return result.insertId;
}

/**
 * 같은 번호로 또 넣었는지 본다.
 *
 * 폼을 두 번 눌렀거나 장난으로 도배하는 걸 막는 용도라, 막지 않고 "이미 접수됨"으로
 * 돌려준다 — 신청자 입장에서는 성공으로 보이는 편이 낫다.
 */
export async function findRecentByPhone(phone: string, withinHours = 24): Promise<SellerApplication | null> {
  const row = await queryOne<Row>(
    `SELECT * FROM seller_applications
      WHERE phone = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
      ORDER BY created_at DESC LIMIT 1`,
    [phone, withinHours],
  );
  return row ? toApplication(row) : null;
}

export async function listApplications(status?: SellerApplicationStatus): Promise<SellerApplication[]> {
  const rows = status
    ? await query<Row>('SELECT * FROM seller_applications WHERE status = ? ORDER BY created_at DESC', [status])
    : await query<Row>('SELECT * FROM seller_applications ORDER BY created_at DESC');
  return rows.map(toApplication);
}

export async function countByStatus(): Promise<{ status: SellerApplicationStatus; count: number }[]> {
  const rows = await query<RowDataPacket & { status: SellerApplicationStatus; n: number }>(
    'SELECT status, COUNT(*) AS n FROM seller_applications GROUP BY status',
  );
  return rows.map((row) => ({ status: row.status, count: Number(row.n) }));
}

export async function getApplication(id: number): Promise<SellerApplication | null> {
  const row = await queryOne<Row>('SELECT * FROM seller_applications WHERE id = ?', [id]);
  return row ? toApplication(row) : null;
}

export async function updateApplication(
  id: number,
  patch: { status?: SellerApplicationStatus; memo?: string | null },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.status !== undefined) {
    sets.push('status = ?');
    params.push(patch.status);
  }
  if (patch.memo !== undefined) {
    sets.push('memo = ?');
    params.push(patch.memo);
  }
  if (sets.length === 0) return;

  params.push(id);
  await execute(`UPDATE seller_applications SET ${sets.join(', ')} WHERE id = ?`, params);
}

export async function deleteApplication(id: number): Promise<void> {
  await execute('DELETE FROM seller_applications WHERE id = ?', [id]);
}
