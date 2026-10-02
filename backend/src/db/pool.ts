import { createPool, type Pool, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise';

/** mysql2 가 받아주는 파라미터 값 — 호출부는 unknown[] 로 넘기고 여기서 한 번만 맞춘다 */
type SqlParam = string | number | boolean | Date | Buffer | null;

/**
 * MySQL 커넥션 풀.
 *
 * DATABASE_URL 형식: mysql://user:password@host:port/database
 * 날짜는 문자열로 받는다 — Date 객체로 받으면 서버 시간대에 따라 하루가 밀릴 수 있다.
 */
let pool: Pool | null = null;

export function db(): Pool {
  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 이 없습니다. .env.local 을 확인하세요 (.env.example 참고).');

  pool = createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    dateStrings: true,
    timezone: '+09:00',
    supportBigNumbers: true,
  });
  return pool;
}

/** SELECT — 여러 행 */
export async function query<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T[]> {
  const [rows] = await db().query(sql, params as SqlParam[]);
  return rows as T[];
}

/** SELECT — 첫 행만 (없으면 null) */
export async function queryOne<T = RowDataPacket>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** INSERT / UPDATE / DELETE */
export async function execute(sql: string, params: unknown[] = []): Promise<ResultSetHeader> {
  const [result] = await db().execute(sql, params as SqlParam[]);
  return result as ResultSetHeader;
}

/** 여러 쿼리를 한 트랜잭션으로 묶는다 */
export async function withTransaction<T>(run: (conn: Awaited<ReturnType<Pool['getConnection']>>) => Promise<T>): Promise<T> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const result = await run(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function closePool() {
  await pool?.end();
  pool = null;
}
