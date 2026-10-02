import type { RowDataPacket } from 'mysql2';
import { query, queryOne } from '../db/pool.js';
import type { Shop } from '../types.js';

interface ShopRow extends RowDataPacket {
  id: number;
  slug: string;
  name: string;
  region: string;
  area: string;
  owner_id: number | null;
  intro: string;
  rating: string;
  review_count: number;
  verified: number;
}

const toShop = (row: ShopRow): Shop => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  region: row.region as Shop['region'],
  area: row.area,
  ownerId: row.owner_id,
  intro: row.intro,
  // DECIMAL 은 드라이버가 문자열로 준다
  rating: Number(row.rating),
  reviewCount: row.review_count,
  verified: Boolean(row.verified),
});

export async function listShops(): Promise<Shop[]> {
  const rows = await query<ShopRow>('SELECT * FROM shops ORDER BY verified DESC, review_count DESC');
  return rows.map(toShop);
}

export async function getShopBySlug(slug: string): Promise<Shop | null> {
  const row = await queryOne<ShopRow>('SELECT * FROM shops WHERE slug = ?', [slug]);
  return row ? toShop(row) : null;
}

export async function getShopByOwner(userId: number): Promise<Shop | null> {
  const row = await queryOne<ShopRow>('SELECT * FROM shops WHERE owner_id = ?', [userId]);
  return row ? toShop(row) : null;
}
