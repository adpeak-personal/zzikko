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
  /** 켜면 `q` 에 걸리는 것을 **빼고** 본다 */
  exclude?: boolean;
  role?: string;
  /** 용도가 비어 있는 것만 — `role` 보다 먼저 본다 */
  noRole?: boolean;
  usable?: boolean;
  working?: boolean;
  page: number;
  size: number;
}

/**
 * 거르는 조건을 만든다. 목록과 집계가 **같은 규칙**을 써야 화면의 숫자와 줄 수가 맞는다.
 *
 * `skipRole` 은 용도 집계에서 쓴다 — 용도별 개수를 셀 때 용도로 거르면 고른 것 하나만 남는다.
 */
function buildWhere(filter: NworkFilter, skipRole = false) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.q) {
    // 아이디·메모 어디에 있든 찾는다 — 메모에 이름·생년·작업 기록이 섞여 있다
    //
    // ⚠️ 메모는 비어 있으면 NULL 이라 `COALESCE` 로 빈 문자열로 바꿔 놓는다.
    //    안 그러면 '제외'를 켰을 때 `NOT (… NULL …)` 이 NULL 이 돼서,
    //    **메모가 빈 계정이 통째로 사라진다.** 찾을 때는 티가 안 나고 뺄 때만 터진다.
    const match = `(n_id LIKE ? OR COALESCE(n_memo1, '') LIKE ? OR COALESCE(n_memo2, '') LIKE ?
                    OR COALESCE(n_memo3, '') LIKE ?)`;
    where.push(filter.exclude ? `NOT ${match}` : match);
    const like = `%${filter.q}%`;
    params.push(like, like, like, like);
  }
  if (!skipRole) {
    if (filter.noRole) {
      // 용도가 비어 있는 것들. 옛 자료에 섞여 있어서 따로 고를 수 있게 둔다
      where.push("(task_role IS NULL OR task_role = '')");
    } else if (filter.role) {
      where.push('task_role = ?');
      params.push(filter.role);
    }
  }
  if (filter.usable !== undefined) {
    where.push('use_status = ?');
    params.push(filter.usable ? 1 : 0);
  }
  if (filter.working !== undefined) {
    where.push('work_used = ?');
    params.push(filter.working ? 1 : 0);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function listAccounts(filter: NworkFilter): Promise<Paged<NworkAccount>> {
  const { sql: whereSql, params } = buildWhere(filter);

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

/**
 * 목록 위에 띄울 건수.
 *
 * - 상태(전체·사용 가능·사용 불가)는 **검색어 안에서** 센다. 검색을 걸어 두고
 *   상태를 고를 때 숫자가 맞아야 한다.
 * - 용도별 개수는 거기에 **상태까지 반영**해서 센다 — "사용 불가인 블로그 계정이 몇 개" 가
 *   바로 보여야 고를 수 있다. 용도 자체는 빼고 센다(고른 것만 남으면 셀 이유가 없다).
 */
export async function summary(filter: NworkFilter): Promise<NworkSummary> {
  // 상태 칸은 상태를 빼고 센다 — '사용 가능'을 고른 채로도 '사용 불가'가 몇 개인지 보여야 한다
  const base = buildWhere({ ...filter, usable: undefined, working: undefined, role: '', noRole: false });
  const [totals] = await query<RowDataPacket & { total: number; usable: number; working: number }>(
    `SELECT COUNT(*) AS total, SUM(use_status = 1) AS usable, SUM(work_used = 1) AS working FROM nwork ${base.sql}`,
    base.params,
  );

  const scoped = buildWhere(filter, true);
  const roles = await query<RowDataPacket & { task_role: string | null; n: number }>(
    `SELECT task_role, COUNT(*) AS n FROM nwork ${scoped.sql} GROUP BY task_role ORDER BY n DESC`,
    scoped.params,
  );

  // 비어 있는 용도는 한 줄로 모은다 (NULL 과 '' 가 섞여 있을 수 있다)
  const named = roles.filter((row) => (row.task_role ?? '').trim() !== '');
  const blank = roles.reduce((sum, row) => sum + ((row.task_role ?? '').trim() === '' ? Number(row.n) : 0), 0);

  return {
    total: Number(totals?.total ?? 0),
    usable: Number(totals?.usable ?? 0),
    working: Number(totals?.working ?? 0),
    roles: named.map((row) => ({ role: row.task_role as string, count: Number(row.n) })),
    noRole: blank,
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
  /** 붙일 블로그 작업 프로필 이름 (blog_profiles.name). 빈 문자열이면 떼어 낸다 */
  profile?: string;
}

const emptyToNull = (value: string) => (value.trim() ? value.trim() : null);

export async function createAccount(input: NworkInput & { password: string }): Promise<number> {
  const result = await execute(
    // ⚠️ 칸 수와 ? 수를 반드시 맞출 것 — mysql2 는 값이 남아도 조용히 버린다.
    //    실제로 work_profile 을 값에만 넣고 칸에서 빠뜨려, 프로필이 안 들어간 적이 있다.
    `INSERT INTO nwork (n_id, n_pwd, n_memo1, n_memo2, n_memo3, use_status, task_role, work_used, work_profile)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.loginId,
      input.password,
      emptyToNull(input.memo1),
      emptyToNull(input.memo2),
      emptyToNull(input.memo3),
      input.usable ? 1 : 0,
      input.role,
      input.working ? 1 : 0,
      emptyToNull(input.profile ?? ''),
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
  // 프로필은 보낸 경우에만 바꾼다 — 안 보낸 화면이 저장해도 떨어지지 않게
  if (input.profile !== undefined) {
    await execute('UPDATE nwork SET work_profile = ? WHERE n_idx = ?', [emptyToNull(input.profile), id]);
  }
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

/**
 * 메모2 한 칸만 고친다 — 표에서 바로 적게 하려고.
 *
 * 메모2 는 '최근 작업 기록' 자리라 자주 바뀐다. 그때마다 수정 화면을 열면
 * 아이디·비밀번호까지 같이 보내야 해서, 다른 칸을 건드릴 위험이 생긴다.
 */
export async function updateMemo2(id: number, value: string): Promise<boolean> {
  const { affectedRows } = await execute('UPDATE nwork SET n_memo2 = ? WHERE n_idx = ?', [emptyToNull(value), id]);
  return affectedRows > 0;
}
