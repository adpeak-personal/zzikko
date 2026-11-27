import { randomUUID } from 'node:crypto';
import { execute, query, withTransaction } from '../db/pool.js';
import { lowestByModel } from '../lib/sise/compare.js';
import type { SiseRow, SiseSheet } from '../types.js';

const modelName = (row: SiseRow) => [row.model, row.storage].filter(Boolean).join(' ');
const modelKey = (row: SiseRow) => JSON.stringify([row.model, row.storage]);
const priceLabel = (price: number) => price < 0 ? `페이백 ${-price}만 원` : `${price}만 원`;

export function listSources() {
  return query<{ id: number; region: string; datedOn: string }>(
    'SELECT id, region, dated_on AS datedOn FROM sise_sheets ORDER BY dated_on DESC, id DESC',
  );
}

export function buildDraft(sheet: SiseSheet) {
  const prices = lowestByModel(sheet.rows);
  const conditionsByModel = new Map<string, Map<string, SiseRow>>();
  for (const row of sheet.rows) {
    const key = modelKey(row);
    const conditions = conditionsByModel.get(key) ?? new Map<string, SiseRow>();
    const condition = JSON.stringify([row.carrier, row.joinType]);
    const previous = conditions.get(condition);
    if (!previous || row.price < previous.price) conditions.set(condition, row);
    conditionsByModel.set(key, conditions);
  }
  const featured = prices.find((row) => (conditionsByModel.get(modelKey(row))?.size ?? 0) > 1) ?? prices[0];
  const conditions = featured
    ? [...(conditionsByModel.get(modelKey(featured))?.values() ?? [])].sort((a, b) => a.price - b.price)
    : [];
  const source = `찍고 시세표 · ${sheet.datedOn}`;
  const first = conditions[0];
  const second = conditions[1];
  const conditionLabel = (row: SiseRow) => `${row.carrier} ${row.joinType} ${priceLabel(row.price)}`;
  const middle = first && second
    ? `${modelName(first)}의 가격을 조건별로 비교해봤어요. 표에 나온 ${conditionLabel(first)}와 ${conditionLabel(second)} 조건은 ${first.price === second.price ? '표기 가격이 같아요' : `${second.price - first.price}만 원 차이예요`}. 요금제가 다를 수 있으니 표에 나온 요금제와 실제 유지 기간을 함께 확인해보세요.`
    : first
      ? `${modelName(first)}는 이 시세표에 ${conditionLabel(first)} 조건이 있어요. 아래 표에서 적용 요금제를 확인하고, 다른 통신사나 가입 유형이 필요하면 매장에 같은 기종으로 문의해보세요.`
      : '';
  return {
    title: `${sheet.region} 휴대폰 성지 시세 정리 (${sheet.datedOn})`,
    intro: `${sheet.region}에서 휴대폰을 바꿀 때 참고할 수 있도록 ${sheet.datedOn} 기준 찍고 시세표를 정리했어요. 아래 표에는 등록된 조건 중 기종·용량별로 가격이 가장 낮은 조건을 한 줄씩 골랐어요. 쓰고 있는 통신사를 그대로 유지할 계획이라면 가입 유형을 먼저 확인해보세요.`,
    middle,
    outro: '매장에 문의할 때는 원하는 기종과 용량을 먼저 말하고, 할부원금·요금제 유지 기간·필수 부가서비스를 함께 확인해보세요. 번호이동을 고려한다면 기존 약정의 위약금도 비교에 넣는 게 좋아요.',
    card: {
      title: `${sheet.region} 기종별 시세`,
      source,
      columns: ['기종 / 용량', '통신사', '가입 유형', '요금제', '할부원금'],
      rows: prices.map((row) => [
        modelName(row), row.carrier, row.joinType, row.plan || '미기재', priceLabel(row.price),
      ]),
    },
    comparison: {
      title: featured ? `${modelName(featured)} 가입 조건` : '가입 조건',
      source,
      columns: ['통신사', '가입 유형', '요금제', '할부원금'],
      rows: conditions.map((row) => [row.carrier, row.joinType, row.plan || '미기재', priceLabel(row.price)]),
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
