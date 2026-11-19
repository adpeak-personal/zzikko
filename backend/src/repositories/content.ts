import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import type { Chipset, ContentImage, NewsArticle, PhoneSpec } from '../types.js';
import { publicUrl, toStored } from '../lib/storage.js';
import { linkUploadsToOwner, unlinkUploadsOfOwner } from './uploads.js';

/* ── 사진 ─────────────────────────────────────────
 *
 * DB 에는 도메인 없는 경로만 넣는다 (storage.ts 의 toStored / publicUrl).
 * thumb_url 은 images[0] 에서 따 두는 값이라 따로 받지 않는다 — 두 군데서 관리하면 어긋난다.
 *
 * ⚠️ 저장할 때 uploads 에 주인을 적어 준다. 안 하면 뒷정리가 "아무 데도 안 쓰인 파일"로
 *    보고 24시간 뒤에 지운다. 그래서 라우트가 아니라 여기서 한다 — 호출하는 쪽이
 *    한 번만 빠뜨려도 사진이 조용히 사라진다.
 */

interface RawImage {
  url?: unknown;
  caption?: unknown;
}

/** DB → 화면용 (전체 주소) */
function toImages(raw: unknown): ContentImage[] {
  if (!Array.isArray(raw)) return [];
  const out: ContentImage[] = [];
  for (const item of raw as RawImage[]) {
    if (!item || typeof item.url !== 'string' || !item.url) continue;
    out.push({ url: publicUrl(item.url), caption: typeof item.caption === 'string' ? item.caption : '' });
  }
  return out;
}

/** 화면 → DB (도메인 없는 경로) */
function fromImages(images: ContentImage[] | undefined) {
  const list = (images ?? [])
    .filter((item) => item && typeof item.url === 'string' && item.url)
    .map((item) => ({ url: toStored(item.url), caption: item.caption ?? '' }));

  return {
    json: list.length ? JSON.stringify(list) : null,
    /** 목록 카드가 쓰는 대표 사진 */
    first: list[0]?.url ?? null,
    /** uploads 와 맞춰볼 저장형 주소들 */
    urls: list.map((item) => item.url),
  };
}

/* ── IT 소식 ─────────────────────────────────────── */

interface NewsRow extends RowDataPacket {
  id: number;
  title: string;
  category: string;
  summary: string;
  body: string;
  thumb: string;
  images: unknown;
  thumb_url: string | null;
  source_name: string | null;
  source_url: string | null;
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
  images: toImages(row.images),
  thumbUrl: row.thumb_url ? publicUrl(row.thumb_url) : null,
  sourceName: row.source_name,
  sourceUrl: row.source_url,
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

/** thumbUrl 은 images[0] 에서 만들어지므로 입력으로 받지 않는다 */
export type NewsInput = Omit<NewsArticle, 'id' | 'thumbUrl'>;

/** 대표 기사는 하나만 — 새로 지정하면 나머지를 내린다 */
async function clearOtherFeatured(keepId: number) {
  await execute('UPDATE news_articles SET featured = 0 WHERE id <> ?', [keepId]);
}

export async function createNews(input: NewsInput): Promise<number> {
  const images = fromImages(input.images);
  const result = await execute(
    `INSERT INTO news_articles (title, category, summary, body, thumb, images, thumb_url, source_name, source_url, author, date, featured, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.category,
      input.summary,
      input.body,
      input.thumb,
      images.json,
      images.first,
      input.sourceName ?? null,
      input.sourceUrl ?? null,
      input.author,
      input.date,
      input.featured ? 1 : 0,
      input.published ? 1 : 0,
    ],
  );
  if (input.featured) await clearOtherFeatured(result.insertId);
  await linkUploadsToOwner(`news:${result.insertId}`, images.urls);
  return result.insertId;
}

export async function updateNews(id: number, input: NewsInput) {
  const images = fromImages(input.images);
  await execute(
    `UPDATE news_articles
        SET title = ?, category = ?, summary = ?, body = ?, thumb = ?, images = ?, thumb_url = ?,
            source_name = ?, source_url = ?,
            author = ?, date = ?, featured = ?, published = ?
      WHERE id = ?`,
    [
      input.title,
      input.category,
      input.summary,
      input.body,
      input.thumb,
      images.json,
      images.first,
      input.sourceName ?? null,
      input.sourceUrl ?? null,
      input.author,
      input.date,
      input.featured ? 1 : 0,
      input.published ? 1 : 0,
      id,
    ],
  );
  if (input.featured) await clearOtherFeatured(id);
  // 빠진 사진은 연결이 끊겨 청소 대상으로 돌아간다
  await linkUploadsToOwner(`news:${id}`, images.urls);
}

export async function deleteNews(id: number) {
  await execute('DELETE FROM news_articles WHERE id = ?', [id]);
  // 쓰던 사진을 청소 대상으로 돌린다 — 안 그러면 주인 없는 파일이 영영 남는다
  await unlinkUploadsOfOwner(`news:${id}`);
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
  images: unknown;
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
  images: toImages(row.images),
  thumbUrl: row.thumb_url ? publicUrl(row.thumb_url) : null,
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

/** thumbUrl 은 images[0] 에서 만들어지므로 입력으로 받지 않는다 */
export type SpecInput = Omit<PhoneSpec, 'id' | 'thumbUrl'>;

const specParams = (input: SpecInput, images: ReturnType<typeof fromImages>) => [
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
  images.json,
  images.first,
  input.published ? 1 : 0,
];

export async function createSpec(input: SpecInput): Promise<number> {
  const images = fromImages(input.images);
  const result = await execute(
    `INSERT INTO phone_specs
       (name, brand, release_date, retail_price, chipset_id, display, storage, battery, charging,
        camera_main, camera_front, weight, display_inch, refresh_hz, memory_gb, battery_mah,
        charging_watt, camera_main_mp, weight_g, thumb, images, thumb_url, published)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    specParams(input, images),
  );
  await linkUploadsToOwner(`spec:${result.insertId}`, images.urls);
  return result.insertId;
}

export async function updateSpec(id: number, input: SpecInput) {
  const images = fromImages(input.images);
  await execute(
    `UPDATE phone_specs
        SET name = ?, brand = ?, release_date = ?, retail_price = ?, chipset_id = ?, display = ?, storage = ?,
            battery = ?, charging = ?, camera_main = ?, camera_front = ?, weight = ?, display_inch = ?,
            refresh_hz = ?, memory_gb = ?, battery_mah = ?, charging_watt = ?, camera_main_mp = ?,
            weight_g = ?, thumb = ?, images = ?, thumb_url = ?, published = ?
      WHERE id = ?`,
    [...specParams(input, images), id],
  );
  await linkUploadsToOwner(`spec:${id}`, images.urls);
}

export async function deleteSpec(id: number) {
  await execute('DELETE FROM phone_specs WHERE id = ?', [id]);
  await unlinkUploadsOfOwner(`spec:${id}`);
}
