import { createHash, createHmac, randomInt } from 'node:crypto';

/**
 * 휴대폰 번호 다루기.
 *
 * ⚠️ 번호 원본은 DB 에 두지 않는다. 우리가 번호로 하는 일은 "한 번호로 계정 여러 개 못 만들게"
 * 뿐이라, 같은 번호인지만 알면 된다. 그래서 HMAC 으로 바꿔 둔다 — 키 없이는 되돌릴 수 없다.
 * (그냥 sha256 이면 010 번호는 1억 개뿐이라 몇 초면 전부 대입해 풀린다.)
 *
 * ⚠️ 키로 `JWT_SECRET` 을 쓴다. **JWT_SECRET 을 바꾸면 이미 저장된 번호와 비교가 안 된다** —
 * 같은 번호로 또 가입할 수 있게 된다. 세션도 전부 끊기므로 원래 함부로 바꾸지 않는 값이다.
 */

/** 010-1234-5678 / +82 10 1234 5678 → 01012345678. 휴대폰 번호가 아니면 null */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+82')) digits = `0${digits.slice(3)}`;
  digits = digits.replace(/\D/g, '');
  return /^01[016789]\d{7,8}$/.test(digits) ? digits : null;
}

export function hashPhone(phone: string): string {
  const key = process.env.JWT_SECRET;
  if (!key) throw new Error('JWT_SECRET 이 없습니다');
  return createHmac('sha256', key).update(`phone:${phone}`).digest('hex');
}

/** 6자리 인증번호 */
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** 인증번호도 원본을 두지 않는다. 번호마다 결과가 달라지게 phone_hash 를 섞는다 */
export const hashCode = (phoneHash: string, code: string) =>
  createHash('sha256').update(`${phoneHash}:${code}`).digest('hex');
