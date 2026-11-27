import { randomUUID } from 'node:crypto';
import { execute, query, queryOne, withTransaction } from '../db/pool.js';
import { lowestByModel } from '../lib/sise/compare.js';
import type { PhoneSpec, SiseRow, SiseSheet } from '../types.js';

const modelName = (row: SiseRow) => [row.model, row.storage].filter(Boolean).join(' ');
const modelKey = (row: SiseRow) => JSON.stringify([row.model, row.storage]);
const priceLabel = (price: number) => price < 0 ? `페이백 ${-price}만 원` : `${price}만 원`;
const normalizedModel = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export function listSources() {
  return query<{ id: number; region: string; datedOn: string }>(
    'SELECT id, region, dated_on AS datedOn FROM sise_sheets ORDER BY dated_on DESC, id DESC',
  );
}

export function buildDraft(sheet: SiseSheet, specs: PhoneSpec[] = []) {
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
  const priceColumns = ['기종 / 용량', '통신사', '가입 유형', '요금제', '할부원금'];
  const priceRows = prices.map((row) => [
    modelName(row), row.carrier, row.joinType, row.plan || '미기재', priceLabel(row.price),
  ]);
  const pageSize = Math.max(8, Math.ceil(priceRows.length / 4));
  const priceCards = [];
  for (let start = 0; start < priceRows.length; start += pageSize) {
    priceCards.push({
      title: `${sheet.region} 기종별 시세${priceRows.length > pageSize ? ` (${priceCards.length + 1})` : ''}`,
      source, columns: priceColumns, rows: priceRows.slice(start, start + pageSize),
    });
  }
  const first = conditions[0];
  const second = conditions[1];
  const conditionLabel = (row: SiseRow) => `${row.carrier} ${row.joinType} ${priceLabel(row.price)}`;
  const middle = first && second
    ? `${modelName(first)}의 가격을 조건별로 비교해봤어요. ${conditionLabel(first)}와 ${conditionLabel(second)} 조건은 ${first.price === second.price ? '표기 가격이 같아요' : `${second.price - first.price}만 원 차이예요`}. 월 요금이 다르면 실제 지출 순서도 달라질 수 있어요. 두 조건의 요금제와 유지 기간을 같은 기준으로 놓고 계산해보세요.`
    : first
      ? `${modelName(first)}는 이 시세표에 ${conditionLabel(first)} 조건이 있어요. 아래 표에서 적용 요금제를 확인하고, 다른 통신사나 가입 유형이 필요하면 매장에 같은 기종으로 문의해보세요.`
      : '';
  const spec = featured && specs.find((item) => normalizedModel(item.name) === normalizedModel(featured.model));
  const specRows = spec
    ? ([['화면', spec.display], ['배터리', spec.battery], ['후면 카메라', spec.cameraMain], ['무게', spec.weight]] satisfies [string, string][])
        .filter(([, value]) => value.trim()).slice(0, 3)
    : [];
  const deviceName = featured ? modelName(featured) : '후보 기종';
  const device = {
    text: specRows.length
      ? `${deviceName}에 대해 찍고에 등록된 기기 정보도 함께 정리했어요. ${specRows.map(([label, value]) => `${label}은 ${value.slice(0, 55)}`).join(', ')}예요. 화면과 무게는 매일 들고 다닐 때 체감이 크고, 사진이나 영상을 많이 남긴다면 같은 기종이라도 저장 용량까지 확인해보세요.`
      : `${deviceName}을 후보로 보고 있다면 용량부터 확인해보세요. 같은 모델도 저장 용량에 따라 시세가 달라지고, 사진이나 영상을 많이 남기면 현재 쓰는 휴대폰의 저장 공간 사용량이 기준이 돼요. 한 손으로 자주 쓴다면 화면 크기와 무게도 매장에서 직접 비교해보는 게 좋아요.`,
    card: {
      title: `${deviceName} 구매 전 확인`,
      source: specRows.length ? '찍고 휴대폰 기기 정보' : '기기 선택 체크리스트',
      columns: ['항목', '확인 내용'],
      rows: specRows.length ? specRows : [['저장 용량', '현재 기기의 저장 공간 사용량과 비교'], ['화면과 무게', '한 손 사용과 휴대성 확인'], ['배터리와 카메라', '평소 사용하는 기능 중심으로 비교']],
    },
  };
  const checklist = {
    text: '상담받을 때는 원하는 기종과 용량을 정한 뒤 할부원금, 요금제 유지 기간, 필수 부가서비스를 한 번에 물어보세요. 카드 실적이나 인터넷 결합을 전제로 한 가격이라면 그 조건을 빼도 같은 금액인지 확인하세요. 번호이동을 생각 중이라면 현재 통신사에서 위약금과 남은 단말 할부금도 따로 확인해두세요.',
    card: {
      title: '매장 상담에서 확인할 항목',
      source: '휴대폰 구매 체크리스트',
      columns: ['항목', '매장에 물어볼 내용'],
      rows: [['할부원금', '계약서에 적히는 단말기 금액'], ['요금제와 부가서비스', '월 비용과 필수 유지 기간'], ['추가 조건', '카드 실적·결합 적용 여부'], ['번호이동', '기존 약정 위약금 별도 확인']],
    },
  };
  return {
    title: `${sheet.region} 휴대폰 성지 시세 정리 (${sheet.datedOn})`,
    intro: `${sheet.region}에서 휴대폰을 바꿀 때 참고할 수 있도록 ${sheet.datedOn} 기준 찍고 시세표를 정리했어요. 아래 표에는 등록된 조건 중 기종·용량별로 가격이 가장 낮은 조건을 한 줄씩 골랐어요. 쓰고 있는 통신사를 그대로 유지할 계획이라면 가입 유형을 먼저 확인해보세요.`,
    middle,
    outro: '시세표는 방문 전에 후보를 좁히는 데 쓰면 편해요. 매장마다 받은 조건을 기종과 용량, 가입 유형, 유지 기간 순으로 적어두고 같은 조건끼리 비교해보세요. 실제 계약 전에는 안내받은 금액이 계약서의 할부원금과 일치하는지도 확인하세요.',
    card: priceCards[0],
    morePrices: priceCards.slice(1).map((card) => ({
      text: `다음 표에는 ${card.rows[0]?.[0] ?? '다음 기종'}부터 이어지는 조건을 모았어요. 같은 모델이라면 용량과 가입 유형을 함께 확인해보세요.`,
      card,
    })),
    comparison: {
      title: featured ? `${modelName(featured)} 가입 조건` : '가입 조건',
      source,
      columns: ['통신사', '가입 유형', '요금제', '할부원금'],
      rows: conditions.map((row) => [row.carrier, row.joinType, row.plan || '미기재', priceLabel(row.price)]),
    },
    details: [device, checklist],
    links: [] as { title: string; url: string }[],
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

export async function listDrafts(requestedPage: number) {
  const size = 20;
  const count = await queryOne<{ total: number }>('SELECT COUNT(*) AS total FROM blog_drafts');
  const total = Number(count?.total ?? 0);
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / size)));
  const items = await query(
    `SELECT d.id, p.name AS profile, d.title, d.status, d.created_at AS createdAt
       FROM blog_drafts d LEFT JOIN blog_profiles p ON p.id = d.profile_id
      ORDER BY d.id DESC LIMIT ? OFFSET ?`,
    [size, (page - 1) * size],
  );
  return { items, total, size, page };
}

export async function deleteDraft(id: number) {
  const result = await execute("DELETE FROM blog_drafts WHERE id = ? AND status <> 'writing'", [id]);
  return result.affectedRows > 0 || !(await queryOne('SELECT id FROM blog_drafts WHERE id = ?', [id]));
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
