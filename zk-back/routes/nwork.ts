// nwork(네이버 아이디 풀) 관리 — /yongadm/accounts 에서 사용.
// 관리자 전용: authenticate + role ∈ {ADMIN, SUB_ADMIN} 체크.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

interface NworkRow extends RowDataPacket {
  n_idx: number;
  n_id: string;
  n_pwd: string;
  n_memo1: string | null;
  n_memo2: string | null;
  n_memo3: string | null;
  last_login_chk: string | null;
  n_lastwork_at: string | null;
  use_status: number;
  task_role: string;
  work_used: number;
  work_user_agent: number | null;
  work_profile: string | null;
}

// task_role 기본 목록 — 데이터가 아직 없어서 DISTINCT 만으로는 셀렉트가 비므로 UI 기본 옵션 보강용
const TASK_ROLE_DEFAULTS = [
  '블로그',
  '블로그준비',
  '최적화의심',
  '카페',
  '카페준비',
  '밴드',
  '밴드준비',
  '지식인',
  '지식인준비',
  '미사용',
];

async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const role = req.user?.role;
  if (role !== 'ADMIN' && role !== 'SUB_ADMIN') {
    return reply.forbidden('관리자만 접근할 수 있습니다.');
  }
}

export default async function nworkRoutes(app: FastifyInstance) {
  // GET /api/yongadm/nwork?q=&page=&limit=&use_status=&task_role=&work_used=&sort=&order=
  //   use_status : '1' | '0'      (선택)
  //   task_role  : 문자열          (선택)
  //   work_used  : '1' | '0'      (선택)
  //   sort       : whitelist       기본 n_idx
  //   order      : 'asc' | 'desc' 기본 desc
  app.get<{
    Querystring: {
      q?: string;
      page?: string;
      limit?: string;
      use_status?: string;
      task_role?: string;
      work_used?: string;
      sort?: string;
      order?: string;
    };
  }>(
    '/nwork',
    { preHandler: [app.authenticate, requireAdmin] },
    async (req) => {
      const page = Math.max(1, Number(req.query.page ?? 1));
      const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 30)));
      const offset = (page - 1) * limit;
      const q = (req.query.q ?? '').trim();
      const useStatus = (req.query.use_status ?? '').trim();
      const taskRole = (req.query.task_role ?? '').trim();
      const workUsed = (req.query.work_used ?? '').trim();

      // 정렬 화이트리스트 — SQL 인젝션 방지
      const SORT_ALLOW = new Set([
        'n_idx',
        'n_id',
        'task_role',
        'use_status',
        'work_used',
        'last_login_chk',
        'n_lastwork_at',
      ]);
      const sortCol = SORT_ALLOW.has(req.query.sort ?? '') ? req.query.sort! : 'n_idx';
      const sortOrder = (req.query.order ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      // 안정 정렬: 같은 값일 때 n_idx DESC 로 tie-break
      const orderSql =
        sortCol === 'n_idx'
          ? `ORDER BY n_idx ${sortOrder}`
          : `ORDER BY ${sortCol} ${sortOrder}, n_idx DESC`;

      const where: string[] = [];
      const params: unknown[] = [];

      if (q) {
        where.push('(n_id LIKE ? OR n_memo1 LIKE ? OR n_memo2 LIKE ? OR n_memo3 LIKE ?)');
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
      }
      if (useStatus === '1' || useStatus === '0') {
        where.push('use_status = ?');
        params.push(Number(useStatus));
      }
      if (taskRole) {
        where.push('task_role = ?');
        params.push(taskRole);
      }
      if (workUsed === '1' || workUsed === '0') {
        where.push('work_used = ?');
        params.push(Number(workUsed));
      }
      const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

      const [rows] = await app.db.query<NworkRow[]>(
        `SELECT n_idx, n_id, n_pwd, n_memo1, n_memo2, n_memo3,
                last_login_chk, n_lastwork_at,
                use_status, task_role, work_used, work_user_agent, work_profile
           FROM nwork
           ${whereSql}
           ${orderSql}
          LIMIT ? OFFSET ?`,
        [...params, limit, offset],
      );

      const [countRows] = await app.db.query<(RowDataPacket & { total: number })[]>(
        `SELECT COUNT(*) AS total FROM nwork ${whereSql}`,
        params,
      );

      // 필터 옵션: DB 에 실제 존재하는 task_role 값 + 기본 목록 합집합
      const [taskRoleRows] = await app.db.query<(RowDataPacket & { task_role: string })[]>(
        `SELECT DISTINCT task_role FROM nwork WHERE task_role IS NOT NULL AND task_role <> ''`,
      );
      const taskRoles = Array.from(
        new Set([...TASK_ROLE_DEFAULTS, ...taskRoleRows.map((r) => r.task_role)]),
      );

      return {
        items: rows,
        total: countRows[0]?.total ?? 0,
        page,
        limit,
        filters: {
          task_roles: taskRoles,
        },
      };
    },
  );

  // ────────────────────────────────────────────────────────────
  // PATCH /api/yongadm/nwork/:idx — 인라인 편집
  //   허용 필드: n_id, n_pwd, n_memo1, n_memo2, n_memo3,
  //             use_status, task_role, work_used, work_user_agent, work_profile
  //   n_id UNIQUE 충돌 시 409 Conflict.
  // ────────────────────────────────────────────────────────────
  app.patch<{
    Params: { idx: string };
    Body: Partial<{
      n_id: string;
      n_pwd: string;
      n_memo1: string | null;
      n_memo2: string | null;
      n_memo3: string | null;
      use_status: 0 | 1;
      task_role: string;
      work_used: 0 | 1;
      work_user_agent: number | null;
      work_profile: string | null;
    }>;
  }>(
    '/nwork/:idx',
    { preHandler: [app.authenticate, requireAdmin] },
    async (req, reply) => {
      const idx = Number(req.params.idx);
      if (!Number.isInteger(idx) || idx < 1) return reply.badRequest('잘못된 idx');

      const body = req.body ?? {};
      const sets: string[] = [];
      const params: unknown[] = [];

      // 문자열 필드
      const strFields: Array<keyof typeof body> = [
        'n_id',
        'n_pwd',
        'n_memo1',
        'n_memo2',
        'n_memo3',
        'task_role',
        'work_profile',
      ];
      for (const f of strFields) {
        if (body[f] === undefined) continue;
        const v = body[f];
        if (v !== null && typeof v !== 'string') {
          return reply.badRequest(`${f} 는 문자열이어야 합니다.`);
        }
        if (f === 'n_id' && (!v || (v as string).trim() === '')) {
          return reply.badRequest('n_id 는 비울 수 없습니다.');
        }
        if (f === 'n_pwd' && (!v || (v as string).trim() === '')) {
          return reply.badRequest('n_pwd 는 비울 수 없습니다.');
        }
        if (f === 'task_role') {
          if (!v || (v as string).trim() === '') {
            return reply.badRequest('task_role 는 비울 수 없습니다.');
          }
          if (!TASK_ROLE_DEFAULTS.includes(v as string)) {
            return reply.badRequest('허용되지 않은 task_role 값입니다.');
          }
        }
        sets.push(`${f} = ?`);
        params.push(v);
      }

      // 불리언(0/1) 필드
      const boolFields: Array<'use_status' | 'work_used'> = ['use_status', 'work_used'];
      for (const f of boolFields) {
        if (body[f] === undefined) continue;
        const v = body[f];
        if (v !== 0 && v !== 1) return reply.badRequest(`${f} 는 0 또는 1 이어야 합니다.`);
        sets.push(`${f} = ?`);
        params.push(v);
      }

      // 정수 필드
      if (body.work_user_agent !== undefined) {
        const v = body.work_user_agent;
        if (v !== null && !Number.isInteger(v)) {
          return reply.badRequest('work_user_agent 는 정수 또는 null 이어야 합니다.');
        }
        sets.push('work_user_agent = ?');
        params.push(v);
      }

      if (sets.length === 0) return reply.badRequest('변경할 필드가 없습니다.');

      try {
        const [result] = await app.db.query<ResultSetHeader>(
          `UPDATE nwork SET ${sets.join(', ')} WHERE n_idx = ?`,
          [...params, idx],
        );
        if (result.affectedRows === 0) return reply.notFound('해당 아이디를 찾을 수 없습니다.');
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === 'ER_DUP_ENTRY') {
          return reply.conflict('이미 존재하는 n_id 입니다.');
        }
        throw err;
      }

      const [rows] = await app.db.query<NworkRow[]>(
        `SELECT n_idx, n_id, n_pwd, n_memo1, n_memo2, n_memo3,
                last_login_chk, n_lastwork_at,
                use_status, task_role, work_used, work_user_agent, work_profile
           FROM nwork WHERE n_idx = ?`,
        [idx],
      );
      return rows[0];
    },
  );

  // ────────────────────────────────────────────────────────────
  // POST /api/yongadm/nwork/migrate?dry=1
  //
  // nwork 스키마 재정비. 이미 적용된 DB 에서는 no-op (컬럼 존재 여부로 판단).
  // 다른 환경(prod/staging) 에도 동일 스키마 반영할 때 재사용.
  // ────────────────────────────────────────────────────────────
  app.post<{ Querystring: { dry?: string } }>(
    '/nwork/migrate',
    { preHandler: [app.authenticate, requireAdmin] },
    async (req) => {
      const dry = req.query.dry === '1' || req.query.dry === 'true';

      const NEW_COLUMNS: Array<{ name: string; ddl: string }> = [
        { name: 'use_status',      ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
        { name: 'task_role',       ddl: "VARCHAR(20) NOT NULL DEFAULT '미사용'" },
        { name: 'work_used',       ddl: 'TINYINT(1) NOT NULL DEFAULT 0' },
        { name: 'work_user_agent', ddl: 'INT NULL' },
        { name: 'work_profile',    ddl: 'VARCHAR(100) NULL' },
      ];

      const DROP_COLUMNS = [
        'login_chk',
        'n_status',
        'n_blog_work',
        'n_blog_standby',
        'n_blog_any',
        'n_cafe',
        'n_kin',
        'n_use',
        'n_used',
        'n_use_com',
        'n_ua',
        'n_ch_profile',
        'n_blog_order',
        'n_link_use',
        'n_work_count',
      ];

      const [colRows] = await app.db.query<
        (RowDataPacket & { COLUMN_NAME: string })[]
      >(
        `SELECT COLUMN_NAME
           FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME   = 'nwork'`,
      );
      const existing = new Set(colRows.map((r) => r.COLUMN_NAME));

      const toAdd = NEW_COLUMNS.filter((c) => !existing.has(c.name));
      const toDrop = DROP_COLUMNS.filter((c) => existing.has(c));

      if (dry) {
        return {
          dry_run: true,
          plan: {
            add: toAdd.map((c) => `${c.name} ${c.ddl}`),
            drop: toDrop,
          },
        };
      }

      const conn = await app.db.getConnection();
      const actions: string[] = [];
      try {
        for (const c of toAdd) {
          await conn.query(`ALTER TABLE nwork ADD COLUMN ${c.name} ${c.ddl}`);
          actions.push(`ADD COLUMN ${c.name}`);
        }
        if (existing.has('login_chk') || existing.has('n_status')) {
          const [r] = await conn.query(
            `UPDATE nwork
                SET use_status = CASE
                      WHEN login_chk = 1 THEN 1
                      WHEN login_chk = 0 THEN 0
                      WHEN n_status = '사용불가' THEN 0
                      ELSE 1
                    END`,
          );
          actions.push(`UPDATE use_status (${(r as { affectedRows: number }).affectedRows} rows)`);
        }
        if (
          existing.has('n_status') &&
          existing.has('n_blog_standby') &&
          existing.has('n_cafe')
        ) {
          const [r] = await conn.query(
            `UPDATE nwork
                SET task_role = CASE
                      WHEN n_status = '밴드사용' THEN '밴드'
                      WHEN n_blog_standby = 1 THEN '블로그준비'
                      WHEN n_cafe = 1 THEN '카페준비'
                      ELSE '미사용'
                    END`,
          );
          actions.push(`UPDATE task_role (${(r as { affectedRows: number }).affectedRows} rows)`);
        }
        if (existing.has('n_used')) {
          const [r] = await conn.query(
            `UPDATE nwork SET work_used = COALESCE(n_used, 0)`,
          );
          actions.push(`UPDATE work_used (${(r as { affectedRows: number }).affectedRows} rows)`);
        }
        if (existing.has('n_ua')) {
          const [r] = await conn.query(
            `UPDATE nwork SET work_user_agent = n_ua`,
          );
          actions.push(`UPDATE work_user_agent (${(r as { affectedRows: number }).affectedRows} rows)`);
        }
        for (const col of toDrop) {
          await conn.query(`ALTER TABLE nwork DROP COLUMN ${col}`);
          actions.push(`DROP COLUMN ${col}`);
        }
      } finally {
        conn.release();
      }

      return {
        dry_run: false,
        actions,
        summary: {
          added: toAdd.map((c) => c.name),
          dropped: toDrop,
        },
      };
    },
  );
}
