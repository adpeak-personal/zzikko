import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import type { NworkAccount, NworkSummary, Paged } from '../types.js';

/*
 * 네이버 작업 계정 (nwork).
 * 블로그·밴드 등 외부 자동화 프로그램이 쓰는 계정 목록이다. 옛 찍고 DB 에서 그대로 옮겨 와서
 * 컬럼 이름이 이 프로젝트 규칙(snake_case 영어)과 다르다 — 변환은 여기서만 한다.
 *
 * 비밀번호(n_pwd)는 목록에 싣지 않는다. 어드민이 눈 아이콘을 누를 때만 getPassword 로 따로 준다.
 */

interface NworkRow extends RowDataPacket {
  n_idx: number;
  n_id: string;
  n_memo1: string | null;
  n_memo2: string | null;
  n_memo3: string | null;
  // 풀이 dateStrings 라 'YYYY-MM-DD HH:MM:SS' 문자열로 온다 (db/pool.ts)
  last_login_chk: string | null;
  n_lastwork_at: string | null;
  use_status: number;
  task_role: string;
  work_used: number;
  work_user_agent: number | null;
  work_profile: string | null;
}

const COLUMNS = `n_idx, n_id, n_memo1, n_memo2, n_memo3, last_login_chk, n_lastwork_at,
                 use_status, task_role, work_used, work_user_agent, work_profile`;

const toAccount = (row: NworkRow): NworkAccount => ({
  id: row.n_idx,
  loginId: row.n_id,
  memo1: row.n_memo1 ?? '',
  memo2: row.n_memo2 ?? '',
  memo3: row.n_memo3 ?? '',
  lastLoginCheckAt: row.last_login_chk,
  lastWorkAt: row.n_lastwork_at,
  usable: Boolean(row.use_status),
  role: row.task_role,
  working: Boolean(row.work_used),
  userAgentId: row.work_user_agent,
  profile: row.work_profile,
});

export interface NworkFilter {
  q?: string;
  role?: string;
  usable?: boolean;
  working?: boolean;
  page: number;
  size: number;
}

export async function listAccounts(filter: NworkFilter): Promise<Paged<NworkAccount>> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.q) {
    // 아이디·메모 어디에 있든 찾는다 — 메모에 이름·생년·작업 기록이 섞여 있다
    where.push('(n_id LIKE ? OR n_memo1 LIKE ? OR n_memo2 LIKE ? OR n_memo3 LIKE ?)');
    const like = `%${filter.q}%`;
    params.push(like, like, like, like);
  }
  if (filter.role) {
    where.push('task_role = ?');
    params.push(filter.role);
  }
  if (filter.usable !== undefined) {
    where.push('use_status = ?');
    params.push(filter.usable ? 1 : 0);
  }
  if (filter.working !== undefined) {
    where.push('work_used = ?');
    params.push(filter.working ? 1 : 0);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRow] = await query<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM nwork ${whereSql}`, params);
  const rows = await query<NworkRow>(
    // 최근에 작업한 계정이 위로. 한 번도 안 쓴 계정은 번호순으로 그 뒤에
    `SELECT ${COLUMNS} FROM nwork ${whereSql}
      ORDER BY n_lastwork_at IS NULL, n_lastwork_at DESC, n_idx DESC
      LIMIT ? OFFSET ?`,
    [...params, filter.size, (filter.page - 1) * filter.size],
  );

  return { items: rows.map(toAccount), total: Number(countRow?.n ?? 0), page: filter.page, size: filter.size };
}

/** 목록 위에 띄울 건수 — 필터와 상관없이 전체 기준 */
export async function summary(): Promise<NworkSummary> {
  const [totals] = await query<RowDataPacket & { total: number; usable: number; working: number }>(
    'SELECT COUNT(*) AS total, SUM(use_status = 1) AS usable, SUM(work_used = 1) AS working FROM nwork',
  );
  const roles = await query<RowDataPacket & { task_role: string; n: number }>(
    'SELECT task_role, COUNT(*) AS n FROM nwork GROUP BY task_role ORDER BY n DESC',
  );
  return {
    total: Number(totals?.total ?? 0),
    usable: Number(totals?.usable ?? 0),
    working: Number(totals?.working ?? 0),
    roles: roles.map((row) => ({ role: row.task_role, count: Number(row.n) })),
  };
}

export async function getAccount(id: number): Promise<NworkAccount | null> {
  const row = await queryOne<NworkRow>(`SELECT ${COLUMNS} FROM nwork WHERE n_idx = ?`, [id]);
  return row ? toAccount(row) : null;
}

export async function getPassword(id: number): Promise<string | null> {
  const row = await queryOne<RowDataPacket & { n_pwd: string }>('SELECT n_pwd FROM nwork WHERE n_idx = ?', [id]);
  return row ? row.n_pwd : null;
}

export async function loginIdTaken(loginId: string, exceptId = 0): Promise<boolean> {
  const row = await queryOne('SELECT 1 FROM nwork WHERE n_id = ? AND n_idx <> ?', [loginId, exceptId]);
  return Boolean(row);
}

export interface NworkInput {
  loginId: string;
  memo1: string;
  memo2: string;
  memo3: string;
  usable: boolean;
  role: string;
  working: boolean;
}

const emptyToNull = (value: string) => (value.trim() ? value.trim() : null);

export async function createAccount(input: NworkInput & { password: string }): Promise<number> {
  const result = await execute(
    `INSERT INTO nwork (n_id, n_pwd, n_memo1, n_memo2, n_memo3, use_status, task_role, work_used)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.loginId,
      input.password,
      emptyToNull(input.memo1),
      emptyToNull(input.memo2),
      emptyToNull(input.memo3),
      input.usable ? 1 : 0,
      input.role,
      input.working ? 1 : 0,
    ],
  );
  return result.insertId;
}

/** password 가 비어 있으면 비밀번호는 그대로 둔다 */
export async function updateAccount(id: number, input: NworkInput & { password?: string }) {
  await execute(
    `UPDATE nwork
        SET n_id = ?, n_memo1 = ?, n_memo2 = ?, n_memo3 = ?, use_status = ?, task_role = ?, work_used = ?
      WHERE n_idx = ?`,
    [
      input.loginId,
      emptyToNull(input.memo1),
      emptyToNull(input.memo2),
      emptyToNull(input.memo3),
      input.usable ? 1 : 0,
      input.role,
      input.working ? 1 : 0,
      id,
    ],
  );
  if (input.password) await execute('UPDATE nwork SET n_pwd = ? WHERE n_idx = ?', [input.password, id]);
}

/** 여러 계정의 용도·상태를 한 번에 바꾼다. 준 항목만 바뀐다 */
export async function bulkUpdate(ids: number[], patch: { role?: string; usable?: boolean; working?: boolean }): Promise<number> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.role !== undefined) {
    sets.push('task_role = ?');
    params.push(patch.role);
  }
  if (patch.usable !== undefined) {
    sets.push('use_status = ?');
    params.push(patch.usable ? 1 : 0);
  }
  if (patch.working !== undefined) {
    sets.push('work_used = ?');
    params.push(patch.working ? 1 : 0);
  }
  if (!sets.length || !ids.length) return 0;
  const result = await execute(
    `UPDATE nwork SET ${sets.join(', ')} WHERE n_idx IN (${ids.map(() => '?').join(',')})`,
    [...params, ...ids],
  );
  return result.affectedRows;
}

/**
 * 여러 줄 붙여넣기로 한꺼번에 추가한다. 이미 있는 아이디는 건너뛴다(덮어쓰지 않음).
 * 돌려주는 값: 추가한 수 · 건너뛴 아이디
 */
export async function importAccounts(
  rows: { loginId: string; password: string; memo1: string }[],
  role: string,
): Promise<{ added: number; skipped: string[] }> {
  const skipped: string[] = [];
  let added = 0;
  for (const row of rows) {
    const result = await execute(
      `INSERT IGNORE INTO nwork (n_id, n_pwd, n_memo1, use_status, task_role, work_used)
       VALUES (?, ?, ?, 1, ?, 0)`,
      [row.loginId, row.password, emptyToNull(row.memo1), role],
    );
    if (result.affectedRows) added += 1;
    else skipped.push(row.loginId);
  }
  return { added, skipped };
}

export async function deleteAccount(id: number) {
  await execute('DELETE FROM nwork WHERE n_idx = ?', [id]);
}
