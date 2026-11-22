import type { RowDataPacket } from 'mysql2';
import { execute, queryOne } from '../db/pool.js';

interface VerificationRow extends RowDataPacket {
  id: number;
  code_hash: string;
  attempts: number;
  expired: number;
}

export async function createVerification(phoneHash: string, codeHash: string, ttlMinutes: number) {
  await execute(
    `INSERT INTO phone_verifications (phone_hash, code_hash, expires_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
    [phoneHash, codeHash, ttlMinutes],
  );
}

/** 그 번호로 마지막에 보낸 것 — 새로 받으면 이전 번호는 자동으로 무효다 */
export async function latestVerification(phoneHash: string) {
  return queryOne<VerificationRow>(
    `SELECT id, code_hash, attempts, expires_at < NOW() AS expired
       FROM phone_verifications
      WHERE phone_hash = ? AND verified_at IS NULL
      ORDER BY id DESC LIMIT 1`,
    [phoneHash],
  );
}

export async function countAttempt(id: number) {
  await execute(`UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?`, [id]);
}

export async function markVerified(id: number) {
  await execute(`UPDATE phone_verifications SET verified_at = NOW() WHERE id = ?`, [id]);
}

/** 발송 제한용 — 이 번호로 최근 보낸 횟수와 마지막 발송 뒤 지난 초 */
export async function recentSends(phoneHash: string) {
  const row = await queryOne<RowDataPacket & { day: number; since: number | null }>(
    `SELECT COUNT(*) AS day, TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) AS since
       FROM phone_verifications
      WHERE phone_hash = ? AND created_at > DATE_SUB(NOW(), INTERVAL 1 DAY)`,
    [phoneHash],
  );
  return { day: Number(row?.day ?? 0), since: row?.since ?? null };
}

/** 사이트 전체 최근 1시간 발송 수 — 문자 요금 폭탄 방지 */
export async function sendsLastHour() {
  const row = await queryOne<RowDataPacket & { n: number }>(
    `SELECT COUNT(*) AS n FROM phone_verifications WHERE created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
  );
  return Number(row?.n ?? 0);
}

/** 오래된 인증 기록 지우기 — 한 달 지난 건 쓸 일이 없다 */
export async function pruneVerifications() {
  await execute(`DELETE FROM phone_verifications WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`);
}
