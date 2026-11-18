import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import { publicUrl, toStored } from '../lib/storage.js';
import type { Region, SiseChange, SiseReport, SiseRow, SiseSections, SiseSheet } from '../types.js';

/**
 * 시세 리포트 저장소.
 *
 * posts 와 분리된 테이블을 쓴다 — 사이트 목록·검색 어디에도 섞이면 안 되는 글이라,
 * 같은 테이블에 두면 모든 조회에 필터를 걸어야 하고 하나만 빠뜨려도 새어 나간다.
 */

interface SheetRow extends RowDataPacket {
  id: number;
  region: string;
  dated_on: string;
  image_url: string;
  rows_json: SiseRow[] | string;
  note: string;
  created_at: string;
}

/** JSON 칼럼은 드라이버가 파싱해 주기도 하고 문자열로 주기도 한다 */
function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

const toSheet = (row: SheetRow): SiseSheet => ({
  id: row.id,
  region: row.region as Region,
  // DATE 칼럼은 dateStrings 로 'YYYY-MM-DD' 문자열로 온다
  datedOn: String(row.dated_on).slice(0, 10),
  imageUrl: publicUrl(row.image_url),
  rows: parseJson<SiseRow[]>(row.rows_json, []),
  note: row.note,
  createdAt: row.created_at,
});

/* ── 시세표 ── */

export interface NewSheet {
  region: Region;
  datedOn: string;
  /** 업로드 응답의 전체 주소. 저장할 때 경로로 바꾼다 */
  imageUrl: string;
  rows: SiseRow[];
  note: string;
  createdBy: number;
}

export async function createSheet(input: NewSheet): Promise<number> {
  const { insertId } = await execute(
    `INSERT INTO sise_sheets (region, dated_on, image_url, rows_json, note, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.region, input.datedOn, toStored(input.imageUrl), JSON.stringify(input.rows), input.note, input.createdBy],
  );
  return insertId;
}

export async function getSheet(id: number): Promise<SiseSheet | null> {
  const row = await queryOne<SheetRow>('SELECT * FROM sise_sheets WHERE id = ?', [id]);
  return row ? toSheet(row) : null;
}

/**
 * 같은 지역의 직전 시세표. 비교 대상이 된다.
 *
 * 기준일이 같은 날 두 장이 올라올 수 있어 id 로도 끊는다 — 그래야 자기 자신을 집지 않는다.
 */
export async function findPreviousSheet(region: string, datedOn: string, excludeId: number): Promise<SiseSheet | null> {
  const row = await queryOne<SheetRow>(
    `SELECT * FROM sise_sheets
      WHERE region = ? AND id <> ? AND (dated_on < ? OR (dated_on = ? AND id < ?))
      ORDER BY dated_on DESC, id DESC
      LIMIT 1`,
    [region, excludeId, datedOn, datedOn, excludeId],
  );
  return row ? toSheet(row) : null;
}

/* ── 리포트 ── */

interface ReportRow extends SheetRow {
  report_id: number;
  slug: string;
  title: string;
  summary: string;
  sections: SiseSections | string;
  changes: SiseChange[] | string | null;
  published: number;
  published_at: string | null;
  views: number;
  report_created_at: string;
  updated_at: string;
  prev_dated_on: string | null;
}

const SELECT_REPORT = `
  SELECT r.id AS report_id, r.slug, r.title, r.summary, r.sections, r.changes,
         r.published, r.published_at, r.views,
         r.created_at AS report_created_at, r.updated_at,
         s.*, prev.dated_on AS prev_dated_on
    FROM sise_reports r
    JOIN sise_sheets s ON s.id = r.sheet_id
    LEFT JOIN sise_sheets prev ON prev.id = r.compared_to
`;

const toReport = (row: ReportRow): SiseReport => ({
  id: row.report_id,
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  sections: parseJson<SiseSections>(row.sections, { lead: '', highlights: [], closing: '' }),
  changes: parseJson<SiseChange[]>(row.changes, []),
  published: Boolean(row.published),
  publishedAt: row.published_at,
  views: row.views,
  createdAt: row.report_created_at,
  updatedAt: row.updated_at,
  sheet: toSheet(row),
  comparedTo: row.prev_dated_on ? String(row.prev_dated_on).slice(0, 10) : null,
});

export interface NewReport {
  sheetId: number;
  slug: string;
  title: string;
  summary: string;
  sections: SiseSections;
  changes: SiseChange[];
  comparedTo: number | null;
}

export async function createReport(input: NewReport): Promise<number> {
  const { insertId } = await execute(
    `INSERT INTO sise_reports (sheet_id, slug, title, summary, sections, changes, compared_to)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.sheetId,
      input.slug,
      input.title,
      input.summary,
      JSON.stringify(input.sections),
      JSON.stringify(input.changes),
      input.comparedTo,
    ],
  );
  return insertId;
}

export async function getReport(id: number): Promise<SiseReport | null> {
  const row = await queryOne<ReportRow>(`${SELECT_REPORT} WHERE r.id = ?`, [id]);
  return row ? toReport(row) : null;
}

/** 공개 화면용 — 발행된 것만 */
export async function getPublishedReport(slug: string): Promise<SiseReport | null> {
  const row = await queryOne<ReportRow>(`${SELECT_REPORT} WHERE r.slug = ? AND r.published = 1`, [slug]);
  return row ? toReport(row) : null;
}

export async function listReports(options: { publishedOnly: boolean; limit?: number }): Promise<SiseReport[]> {
  const where = options.publishedOnly ? 'WHERE r.published = 1' : '';
  const order = options.publishedOnly ? 'r.published_at DESC' : 'r.created_at DESC';
  const rows = await query<ReportRow>(`${SELECT_REPORT} ${where} ORDER BY ${order} LIMIT ?`, [options.limit ?? 200]);
  return rows.map(toReport);
}

/** 사이트맵용 — 주소와 수정 시각만 */
export async function listPublishedSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const rows = await query<RowDataPacket & { slug: string; updated_at: string }>(
    'SELECT slug, updated_at FROM sise_reports WHERE published = 1 ORDER BY published_at DESC',
  );
  return rows.map((row) => ({ slug: row.slug, updatedAt: row.updated_at }));
}

export interface ReportPatch {
  title?: string;
  summary?: string;
  sections?: SiseSections;
  published?: boolean;
}

export async function updateReport(id: number, patch: ReportPatch): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const put = (col: string, value: unknown) => {
    sets.push(`${col} = ?`);
    params.push(value);
  };

  if (patch.title !== undefined) put('title', patch.title);
  if (patch.summary !== undefined) put('summary', patch.summary);
  if (patch.sections !== undefined) put('sections', JSON.stringify(patch.sections));
  if (patch.published !== undefined) {
    put('published', patch.published ? 1 : 0);
    // 처음 발행한 시각은 한 번만 찍는다 — 내렸다 올렸다 해도 날짜가 바뀌지 않게
    if (patch.published) sets.push('published_at = COALESCE(published_at, NOW())');
  }

  if (sets.length === 0) return;
  params.push(id);
  await execute(`UPDATE sise_reports SET ${sets.join(', ')} WHERE id = ?`, params);
}

/** 리포트를 지우면 시세표도 같이 지운다 — 1:1 이고 따로 쓸 데가 없다 */
export async function deleteReport(id: number): Promise<boolean> {
  const report = await queryOne<RowDataPacket & { sheet_id: number }>(
    'SELECT sheet_id FROM sise_reports WHERE id = ?',
    [id],
  );
  if (!report) return false;
  // sise_reports 는 sheet 를 CASCADE 로 참조하므로 시트만 지우면 같이 지워진다
  const { affectedRows } = await execute('DELETE FROM sise_sheets WHERE id = ?', [report.sheet_id]);
  return affectedRows > 0;
}

export async function increaseViews(id: number) {
  await execute('UPDATE sise_reports SET views = views + 1 WHERE id = ?', [id]);
}

/** 주소에 쓸 조각 만들기 — `/sise/seoul-2026-11-18` */
export async function uniqueSlug(base: string): Promise<string> {
  for (let n = 0; n < 50; n++) {
    const slug = n === 0 ? base : `${base}-${n + 1}`;
    const taken = await queryOne('SELECT id FROM sise_reports WHERE slug = ?', [slug]);
    if (!taken) return slug;
  }
  return `${base}-${Date.now()}`;
}
