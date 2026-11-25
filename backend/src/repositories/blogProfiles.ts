import type { RowDataPacket } from 'mysql2';
import { execute, query, queryOne } from '../db/pool.js';
import type { BlogProfile, BlogProfileAccount, RunnerAccount, RunnerProfile } from '../types.js';

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
  expected_ip: string;
  vpn_location: string;
  active: number;
  last_ok_at: string | null;
  created_at: string;
}

const toProfile = (row: ProfileRow, accounts: BlogProfileAccount[]): BlogProfile => ({
  id: row.id,
  name: row.name,
  proxyHost: row.proxy_host,
  proxyPort: row.proxy_port,
  proxyUser: row.proxy_user,
  /** 비밀번호 자체는 주지 않고 들어 있는지만 알려준다 */
  hasProxyPass: Boolean(row.proxy_pass),
  userAgent: row.user_agent,
  note: row.note,
  expectedIp: row.expected_ip,
  vpnLocation: row.vpn_location,
  active: Boolean(row.active),
  lastOkAt: row.last_ok_at,
  accounts,
});

export async function listProfiles(): Promise<BlogProfile[]> {
  // IP 끼리 모이게 정렬한다. 여러 프로필이 같은 IP 를 나눠 쓰므로 IP 가 묶는 단위다.
  // INET_ATON 을 쓰는 이유: 문자열로 줄 세우면 10.x 가 9.x 앞에 온다.
  const rows = await query<ProfileRow>(
    `SELECT * FROM blog_profiles
      ORDER BY (expected_ip = '') ASC,
               INET_ATON(expected_ip) ASC,
               expected_ip ASC,
               active DESC,
               name ASC`,
  );
  if (rows.length === 0) return [];

  // 붙은 계정을 한 번에 받아 프로필별로 나눈다 (프로필마다 따로 묻지 않는다)
  const names = rows.map((row) => row.name);
  const members = await query<RowDataPacket & { n_idx: number; n_id: string; use_status: number; work_profile: string; last_login_chk: string | null }>(
    `SELECT n_idx, n_id, use_status, work_profile, last_login_chk
       FROM nwork
      WHERE work_profile IN (${names.map(() => '?').join(',')})
      ORDER BY n_id`,
    names,
  );

  const byProfile = new Map<string, BlogProfileAccount[]>();
  for (const m of members) {
    const list = byProfile.get(m.work_profile) ?? [];
    list.push({ id: m.n_idx, loginId: m.n_id, usable: Boolean(m.use_status), lastLoginCheckAt: m.last_login_chk });
    byProfile.set(m.work_profile, list);
  }

  return rows.map((row) => toProfile(row, byProfile.get(row.name) ?? []));
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
  expectedIp: string;
  vpnLocation: string;
  active: boolean;
}

export async function createProfile(input: ProfileInput): Promise<number> {
  const { insertId } = await execute(
    `INSERT INTO blog_profiles
       (name, proxy_host, proxy_port, proxy_user, proxy_pass, user_agent, note, expected_ip, vpn_location, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.proxyHost,
      input.proxyPort,
      input.proxyUser,
      input.proxyPass ?? '',
      input.userAgent,
      input.note,
      input.expectedIp,
      input.vpnLocation,
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
        SET name = ?, proxy_host = ?, proxy_port = ?, proxy_user = ?, user_agent = ?, note = ?,
            expected_ip = ?, vpn_location = ?, active = ?
      WHERE id = ?`,
    [
      input.name,
      input.proxyHost,
      input.proxyPort,
      input.proxyUser,
      input.userAgent,
      input.note,
      input.expectedIp,
      input.vpnLocation,
      input.active ? 1 : 0,
      id,
    ],
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
    // 목록과 같은 순서(IP 끼리 모이게). 작업기가 차례로 도는데, 같은 IP 가 붙어 있으면
    // 그 사이에는 VPN 을 바꿀 필요가 없다.
    `SELECT * FROM blog_profiles
       WHERE active = 1 ${onlyProfile ? 'AND name = ?' : ''}
       ORDER BY (expected_ip = '') ASC, INET_ATON(expected_ip) ASC, expected_ip ASC, name ASC`,
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
    id: p.id,
    name: p.name,
    proxyHost: p.proxy_host,
    proxyPort: p.proxy_port,
    proxyUser: p.proxy_user,
    proxyPass: p.proxy_pass,
    userAgent: p.user_agent,
    expectedIp: p.expected_ip,
    vpnLocation: p.vpn_location,
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

/**
 * 작업기가 브라우저에서 잰 IP 를 기록한다.
 *
 * **손으로 적게 두지 않으려고 만들었다** — 오타가 나면 영영 안 맞아서 그 프로필이 통째로 멈춘다.
 * 이미 적혀 있으면 덮지 않는다. 바꾸는 건 사람이 어드민에서 한다.
 */
export async function recordIpIfEmpty(name: string, ip: string): Promise<boolean> {
  const { affectedRows } = await execute(
    "UPDATE blog_profiles SET expected_ip = ? WHERE name = ? AND expected_ip = ''",
    [ip, name],
  );
  return affectedRows > 0;
}

/**
 * 그 프로필을 **이미 다른 계정이 쓰고 있는지.**
 *
 * ⚠️ 프로필 하나에는 아이디 하나만 붙인다. 둘을 붙이면 같은 크롬 폴더를 두 계정이
 * 나눠 쓰게 되는데, 네이버는 브라우저 하나에 한 계정만 로그인시키므로 돌릴 때마다
 * 로그아웃→로그인을 반복하게 된다. 그게 세션을 유지하는 것보다 훨씬 눈에 띈다.
 */
export async function profileTakenBy(name: string, exceptAccountId?: number): Promise<string | null> {
  const row = await queryOne<RowDataPacket & { n_id: string }>(
    `SELECT n_id FROM nwork WHERE work_profile = ?${exceptAccountId ? ' AND n_idx <> ?' : ''} LIMIT 1`,
    exceptAccountId ? [name, exceptAccountId] : [name],
  );
  return row ? row.n_id : null;
}
