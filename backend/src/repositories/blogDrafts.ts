import { randomUUID } from 'node:crypto';
import { execute, query, withTransaction } from '../db/pool.js';
import { lowestByModel } from '../lib/sise/compare.js';
import type { SiseSheet } from '../types.js';

export function listSources() {
  return query<{ id: number; region: string; datedOn: string }>(
    'SELECT id, region, dated_on AS datedOn FROM sise_sheets ORDER BY dated_on DESC, id DESC',
  );
}

export function buildDraft(sheet: SiseSheet) {
  const prices = lowestByModel(sheet.rows);
  return {
    title: `${sheet.region} 휴대폰 성지 시세 정리 (${sheet.datedOn})`,
    intro: `${sheet.datedOn} 기준 ${sheet.region} 휴대폰 시세표에서 기종과 용량별 최저가 조건을 정리했습니다. 전체 매장 최저가가 아닌 이 시세표에 포함된 조건입니다.`,
    outro: '가격은 통신사, 가입 유형, 요금제와 매장 조건에 따라 달라질 수 있습니다. 방문 전 할부원금과 요금제 유지 기간, 부가서비스 조건을 확인하세요.',
    card: {
      title: `${sheet.region} 기종별 시세`,
      source: `찍고 시세표 · ${sheet.datedOn}`,
      columns: ['기종 / 용량', '통신사', '가입 유형', '요금제', '할부원금'],
      rows: prices.map((row) => [
        [row.model, row.storage].filter(Boolean).join(' '), row.carrier, row.joinType, row.plan || '미기재',
        row.price < 0 ? `페이백 ${-row.price}만원` : `${row.price}만원`,
      ]),
    },
  };
}

type Payload = ReturnType<typeof buildDraft>;

export async function enqueue(profileId: number, sheetId: number, draft: Payload) {
  const result = await execute(
    `INSERT INTO blog_drafts (profile_id, sheet_id, title, payload)
     SELECT id, ?, ?, ? FROM blog_profiles WHERE id = ? AND active = 1 AND pending_delete = 0`,
    [sheetId, draft.title, JSON.stringify(draft), profileId],
  );
  return result.affectedRows ? result.insertId : null;
}

export function listDrafts() {
  return query(
    `SELECT d.id, p.name AS profile, d.title, d.status, d.created_at AS createdAt
       FROM blog_drafts d LEFT JOIN blog_profiles p ON p.id = d.profile_id
      ORDER BY d.id DESC LIMIT 100`,
  );
}

export function claim(profileId: number) {
  return withTransaction(async (conn) => {
    const [rows] = await conn.query<import('mysql2').RowDataPacket[]>(
      `SELECT d.id, d.payload FROM blog_drafts d
         JOIN blog_profiles p ON p.id = d.profile_id
        WHERE d.profile_id = ? AND p.active = 1 AND p.pending_delete = 0
          AND (d.status = 'queued' OR (d.status = 'writing' AND d.claimed_at < NOW() - INTERVAL 30 MINUTE))
        ORDER BY d.id LIMIT 1 FOR UPDATE`,
      [profileId],
    );
    const row = rows[0];
    if (!row) return null;
    const token = randomUUID();
    await conn.execute(
      "UPDATE blog_drafts SET status = 'writing', claim_token = ?, claimed_at = NOW() WHERE id = ?",
      [token, row.id],
    );
    const draft = typeof row.payload === 'string' ? JSON.parse(row.payload) as Payload : row.payload as Payload;
    return { ...draft, id: row.id as number, token };
  });
}

export async function finish(id: number, token: string, ok: boolean) {
  const status = ok ? 'entered' : 'queued';
  const result = await execute(
    `UPDATE blog_drafts SET status = ?, claimed_at = NULL
      WHERE id = ? AND claim_token = ? AND status IN ('writing', ?)`,
    [status, id, token, status],
  );
  return result.affectedRows > 0;
}
