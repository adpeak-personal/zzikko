import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import type { BlogProfile, RunnerAccount, RunnerProfile } from '../types.js';

/**
 * 블로그 작업 프로필 — **IP(프록시) 하나와 크롬 프로필 하나가 한 쌍**이다.
 *
 * 계정(`nwork`)이 이 프로필에 붙는다(보통 셋). 묶는 키는 `nwork.work_profile` 의 **이름**이라,
 * ⚠️ 프로필 이름을 바꾸면 붙어 있던 계정이 떨어진다 — 이름을 바꿀 땐 계정도 같이 옮긴다
 * (`renameProfile` 이 한 트랜잭션에서 둘 다 한다).
 *
 * 프록시 비밀번호는 목록에 싣지 않는다. 작업기(`/admin/blog/runner`)만 받아 간다.
 */
interface ProfileRow extends RowDataPacket {
  id: number;
  name: string;
  proxy_host: string;
  proxy_port: number | null;
  proxy_user: string;
  proxy_pass: string;
  user_agent: string;
  note: string;
  active: number;
  last_ok_at: string | null;
  created_at: string;
  accounts?: number;
  usable?: number;
}

const toProfile = (row: ProfileRow): BlogProfile => ({
  id: row.id,
  name: row.name,
  proxyHost: row.proxy_host,
  proxyPort: row.proxy_port,
  proxyUser: row.proxy_user,
  /** 비밀번호 자체는 주지 않고 들어 있는지만 알려준다 */
  hasProxyPass: Boolean(row.proxy_pass),
  userAgent: row.user_agent,
  note: row.note,
  active: Boolean(row.active),
  lastOkAt: row.last_ok_at,
  accounts: Number(row.accounts ?? 0),
  usable: Number(row.usable ?? 0),
});

export async function listProfiles(): Promise<BlogProfile[]> {
  const rows = await query<ProfileRow>(
    // 붙은 계정 수와, 그중 실제로 돌릴 수 있는 수를 따로 센다 —
    // 막혀서 내려간 계정이 있으면 "3개인데 왜 2개만 도나" 가 된다
    `SELECT p.*,
            (SELECT COUNT(*) FROM nwork n WHERE n.work_profile = p.name) AS accounts,
            (SELECT COUNT(*) FROM nwork n WHERE n.work_profile = p.name AND n.use_status = 1) AS usable
       FROM blog_profiles p
      ORDER BY p.active DESC, p.name`,
  );
  return rows.map(toProfile);
}

export async function findProfile(id: number): Promise<ProfileRow | null> {
  return queryOne<ProfileRow>('SELECT * FROM blog_profiles WHERE id = ?', [id]);
}

export interface ProfileInput {
  name: string;
  proxyHost: string;
  proxyPort: number | null;
  proxyUser: string;
  /** 안 보내면 그대로 둔다 (수정할 때) */
  proxyPass?: string;
  userAgent: string;
  note: string;
  active: boolean;
}

export async function createProfile(input: ProfileInput): Promise<number> {
  const { insertId } = await execute(
    `INSERT INTO blog_profiles (name, proxy_host, proxy_port, proxy_user, proxy_pass, user_agent, note, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.proxyHost,
      input.proxyPort,
      input.proxyUser,
      input.proxyPass ?? '',
      input.userAgent,
      input.note,
      input.active ? 1 : 0,
    ],
  );
  return insertId;
}

/**
 * 고치기. 이름이 바뀌면 붙어 있던 계정의 `work_profile` 도 같이 옮긴다 —
 * 안 그러면 계정이 어느 프로필에도 속하지 않게 된다.
 */
export async function updateProfile(id: number, oldName: string, input: ProfileInput): Promise<void> {
  await execute(
    `UPDATE blog_profiles
        SET name = ?, proxy_host = ?, proxy_port = ?, proxy_user = ?, user_agent = ?, note = ?, active = ?
      WHERE id = ?`,
    [input.name, input.proxyHost, input.proxyPort, input.proxyUser, input.userAgent, input.note, input.active ? 1 : 0, id],
  );
  if (input.proxyPass !== undefined) {
    await execute('UPDATE blog_profiles SET proxy_pass = ? WHERE id = ?', [input.proxyPass, id]);
  }
  if (input.name !== oldName) {
    await execute('UPDATE nwork SET work_profile = ? WHERE work_profile = ?', [input.name, oldName]);
  }
}

/** 지우면 붙어 있던 계정은 프로필 없는 상태가 된다(계정 자체는 남긴다) */
export async function deleteProfile(id: number, name: string): Promise<void> {
  await execute('UPDATE nwork SET work_profile = NULL WHERE work_profile = ?', [name]);
  await execute('DELETE FROM blog_profiles WHERE id = ?', [id]);
}

export async function markProfileOk(name: string): Promise<void> {
  await execute('UPDATE blog_profiles SET last_ok_at = NOW() WHERE name = ?', [name]);
}

/* ── 작업기(py)가 받아 가는 묶음 ── */

interface RunnerRow extends RowDataPacket {
  n_idx: number;
  n_id: string;
  n_pwd: string;
  work_profile: string;
  last_login_chk: string | null;
}

/**
 * 돌릴 프로필과 그 안의 계정들. **여기서만 비밀번호가 나간다.**
 * 쓸 수 없다고 표시된 계정(`use_status = 0`)은 빼고 준다 — 막힌 아이디로 또 두드릴 이유가 없다.
 */
export async function runnerBundle(onlyProfile?: string): Promise<RunnerProfile[]> {
  const profiles = await query<ProfileRow>(
    `SELECT * FROM blog_profiles WHERE active = 1 ${onlyProfile ? 'AND name = ?' : ''} ORDER BY name`,
    onlyProfile ? [onlyProfile] : [],
  );
  if (profiles.length === 0) return [];

  const names = profiles.map((p) => p.name);
  const rows = await query<RunnerRow>(
    `SELECT n_idx, n_id, n_pwd, work_profile, last_login_chk
       FROM nwork
      WHERE use_status = 1 AND work_profile IN (${names.map(() => '?').join(',')})
      ORDER BY n_idx`,
    names,
  );

  const byProfile = new Map<string, RunnerAccount[]>();
  for (const row of rows) {
    const list = byProfile.get(row.work_profile) ?? [];
    list.push({ id: row.n_idx, loginId: row.n_id, password: row.n_pwd, lastLoginCheckAt: row.last_login_chk });
    byProfile.set(row.work_profile, list);
  }

  return profiles.map((p) => ({
    name: p.name,
    proxyHost: p.proxy_host,
    proxyPort: p.proxy_port,
    proxyUser: p.proxy_user,
    proxyPass: p.proxy_pass,
    userAgent: p.user_agent,
    accounts: byProfile.get(p.name) ?? [],
  }));
}

/** 작업기가 알려주는 로그인 결과 */
export async function reportLogin(id: number, ok: boolean): Promise<boolean> {
  const { affectedRows } = await execute(
    // 실패하면 '쓸 수 없음'으로 내려 다음 번에 빠진다. 되살리는 건 사람이 어드민에서 한다.
    `UPDATE nwork SET last_login_chk = NOW()${ok ? '' : ', use_status = 0'} WHERE n_idx = ?`,
    [id],
  );
  return affectedRows > 0;
}

/** 그 이름의 프로필이 있는지 — 계정에 프로필을 적을 때 오타를 막는다 */
export async function profileExists(name: string): Promise<boolean> {
  return Boolean(await queryOne('SELECT 1 FROM blog_profiles WHERE name = ?', [name]));
}
