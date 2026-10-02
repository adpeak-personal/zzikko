import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import type { Chipset, NewsArticle, PhoneSpec } from '../types.js';

/* ── IT 소식 ─────────────────────────────────────── */

interface NewsRow extends RowDataPacket {
  id: number;
  title: string;
  category: string;
  summary: string;
  body: string;
  thumb: string;
  thumb_url: string | null;
  author: string;
  date: string;
  featured: number;
  published: number;
}

const toNews = (row: NewsRow): NewsArticle => ({
  id: row.id,
  title: row.title,
  category: row.category,
  summary: row.summary,
  body: row.body,
  thumb: row.thumb,
  thumbUrl: row.thumb_url,
  author: row.author,
  date: row.date,
  featured: Boolean(row.featured),
  published: Boolean(row.published),
});

/** all=true 는 어드민 전용 — 미발행 기사까지 내려준다 */
export async function listNews({ all = false, category }: { all?: boolean; category?: string } = {}): Promise<NewsArticle[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (!all) where.push('published = 1');
  if (category) {
    where.push('category = ?');
    params.push(category);
  }
  const rows = await query<NewsRow>(
    `SELECT * FROM news_articles ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY date DESC, id DESC`,
    params,
  );
  return rows.map(toNews);
}

export async function getNews(id: number): Promise<NewsArticle | null> {
  const row = await queryOne<NewsRow>('SELECT * FROM news_articles WHERE id = ?', [id]);
  return row ? toNews(row) : null;
}

export type NewsInput = Omit<NewsArticle, 'id' | 'thumbUrl'> & { thumbUrl?: string | null };

/** 대표 기사는 하나만 — 새로 지정하면 나머지를 내린다 */
async function clearOtherFeatured(keepId: number) {
  await execute('UPDATE news_articles SET featured = 0 WHERE id <> ?', [keepId]);
}

export async function createNews(input: NewsInput): Promise<number> {
  const result = await execute(
    `INSERT INTO news_articles (title, category, summary, body, thumb, thumb_url, author, date, featured, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.category,
      input.summary,
      input.body,
      input.thumb,
      input.thumbUrl ?? null,
      input.author,
      input.date,
      input.featured ? 1 : 0,
      input.published ? 1 : 0,
    ],
  );
  if (input.featured) await clearOtherFeatured(result.insertId);
  return result.insertId;
}

export async function updateNews(id: number, input: NewsInput) {
  await execute(
    `UPDATE news_articles
        SET title = ?, category = ?, summary = ?, body = ?, thumb = ?, thumb_url = ?,
            author = ?, date = ?, featured = ?, published = ?
      WHERE id = ?`,
    [
      input.title,
      input.category,
      input.summary,
      input.body,
      input.thumb,
      input.thumbUrl ?? null,
      input.author,
      input.date,
      input.featured ? 1 : 0,
      input.published ? 1 : 0,
      id,
    ],
  );
  if (input.featured) await clearOtherFeatured(id);
}

export async function deleteNews(id: number) {
  await execute('DELETE FROM news_articles WHERE id = ?', [id]);
}

/* ── 칩셋 ────────────────────────────────────────── */

interface ChipsetRow extends RowDataPacket {
  id: number;
  name: string;
  maker: string;
  tier: Chipset['tier'];
  year: number;
}

export async function listChipsets(): Promise<Chipset[]> {
  const rows = await query<ChipsetRow>('SELECT * FROM chipsets ORDER BY year DESC, name');
  return rows.map((row) => ({ id: row.id, name: row.name, maker: row.maker, tier: row.tier, year: row.year }));
}

export type ChipsetInput = Omit<Chipset, 'id'>;

export async function createChipset(input: ChipsetInput): Promise<number> {
  const result = await execute('INSERT INTO chipsets (name, maker, tier, year) VALUES (?, ?, ?, ?)', [
    input.name,
    input.maker,
    input.tier,
    input.year,
  ]);
  return result.insertId;
}

export async function updateChipset(id: number, input: ChipsetInput) {
  await execute('UPDATE chipsets SET name = ?, maker = ?, tier = ?, year = ? WHERE id = ?', [
    input.name,
    input.maker,
    input.tier,
    input.year,
    id,
  ]);
}

export async function deleteChipset(id: number) {
  await execute('DELETE FROM chipsets WHERE id = ?', [id]);
}

/** 이 칩셋을 쓰는 기종 수 — 0 이 아니면 삭제를 막는다 */
export async function countSpecsUsingChipset(id: number): Promise<number> {
  const row = await queryOne<RowDataPacket & { total: number }>(
    'SELECT COUNT(*) AS total FROM phone_specs WHERE chipset_id = ?',
    [id],
  );
  return row?.total ?? 0;
}

/* ── 기종 사양 ───────────────────────────────────── */

interface SpecRow extends RowDataPacket {
  id: number;
  name: string;
  brand: PhoneSpec['brand'];
  release_date: string;
  retail_price: number;
  chipset_id: number | null;
  display: string;
  storage: string;
  battery: string;
  charging: string;
  camera_main: string;
  camera_front: string;
  weight: string;
  display_inch: string;
  refresh_hz: number;
  memory_gb: number;
  battery_mah: number;
  charging_watt: number;
  camera_main_mp: number;
  weight_g: number;
  thumb: string;
  thumb_url: string | null;
  published: number;
}

const toSpec = (row: SpecRow): PhoneSpec => ({
  id: row.id,
  name: row.name,
  brand: row.brand,
  releaseDate: row.release_date,
  retailPrice: row.retail_price,
  chipsetId: row.chipset_id,
  display: row.display,
  storage: row.storage,
  battery: row.battery,
  charging: row.charging,
  cameraMain: row.camera_main,
  cameraFront: row.camera_front,
  weight: row.weight,
  // DECIMAL 은 드라이버가 문자열로 준다
  displayInch: Number(row.display_inch),
  refreshHz: row.refresh_hz,
  memoryGb: row.memory_gb,
  batteryMah: row.battery_mah,
  chargingWatt: row.charging_watt,
  cameraMainMp: row.camera_main_mp,
  weightG: row.weight_g,
  thumb: row.thumb,
  thumbUrl: row.thumb_url,
  published: Boolean(row.published),
});

export async function listSpecs({ all = false }: { all?: boolean } = {}): Promise<PhoneSpec[]> {
  const rows = await query<SpecRow>(
    `SELECT * FROM phone_specs ${all ? '' : 'WHERE published = 1'} ORDER BY release_date DESC, name`,
  );
  return rows.map(toSpec);
}

export async function getSpec(id: number): Promise<PhoneSpec | null> {
  const row = await queryOne<SpecRow>('SELECT * FROM phone_specs WHERE id = ?', [id]);
  return row ? toSpec(row) : null;
}

export type SpecInput = Omit<PhoneSpec, 'id' | 'thumbUrl'> & { thumbUrl?: string | null };

const specParams = (input: SpecInput) => [
  input.name,
  input.brand,
  input.releaseDate,
  input.retailPrice,
  input.chipsetId,
  input.display,
  input.storage,
  input.battery,
  input.charging,
  input.cameraMain,
  input.cameraFront,
  input.weight,
  input.displayInch,
  input.refreshHz,
  input.memoryGb,
  input.batteryMah,
  input.chargingWatt,
  input.cameraMainMp,
  input.weightG,
  input.thumb,
  input.thumbUrl ?? null,
  input.published ? 1 : 0,
];

export async function createSpec(input: SpecInput): Promise<number> {
  const result = await execute(
    `INSERT INTO phone_specs
       (name, brand, release_date, retail_price, chipset_id, display, storage, battery, charging,
        camera_main, camera_front, weight, display_inch, refresh_hz, memory_gb, battery_mah,
        charging_watt, camera_main_mp, weight_g, thumb, thumb_url, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    specParams(input),
  );
  return result.insertId;
}

export async function updateSpec(id: number, input: SpecInput) {
  await execute(
    `UPDATE phone_specs
        SET name = ?, brand = ?, release_date = ?, retail_price = ?, chipset_id = ?, display = ?, storage = ?,
            battery = ?, charging = ?, camera_main = ?, camera_front = ?, weight = ?, display_inch = ?,
            refresh_hz = ?, memory_gb = ?, battery_mah = ?, charging_watt = ?, camera_main_mp = ?,
            weight_g = ?, thumb = ?, thumb_url = ?, published = ?
      WHERE id = ?`,
    [...specParams(input), id],
  );
}

export async function deleteSpec(id: number) {
  await execute('DELETE FROM phone_specs WHERE id = ?', [id]);
}
