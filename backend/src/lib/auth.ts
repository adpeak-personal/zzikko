import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { forbidden, unauthorized } from './http.js';
import type { MemberRole } from '../types.js';

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const KEY_LENGTH = 64;

/**
 * 비밀번호 해시 — node 내장 scrypt 를 쓴다.
 * bcrypt 처럼 네이티브 모듈을 깔 필요가 없고, 표준 라이브러리라 설치 환경을 타지 않는다.
 * 저장 형식: `salt(hex):hash(hex)`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;

  const hash = await scrypt(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  const expected = Buffer.from(hashHex, 'hex');
  // 길이가 다르면 timingSafeEqual 이 던지므로 먼저 확인한다
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}

/** 로그인 토큰을 담는 쿠키 이름 */
export const SESSION_COOKIE = 'zzikko_session';

export interface SessionUser {
  id: number;
  nickname: string;
  role: MemberRole;
}

// @fastify/jwt 가 request.user 를 선언하므로 그 타입을 우리 세션 타입으로 바꿔준다.
// 로그인 안 한 요청에서는 undefined 라서 쓰는 쪽에서 반드시 확인한다.
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: SessionUser;
    user: SessionUser;
  }
}

/** 쿠키의 토큰을 읽어 request.user 를 채운다 (로그인 안 했어도 통과) */
export async function loadUser(request: FastifyRequest) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return;
  try {
    request.user = request.server.jwt.verify<SessionUser>(token);
  } catch {
    // 만료·위조된 토큰은 그냥 로그인 안 한 것으로 본다
  }
}

/** 로그인 필수 라우트에 preHandler 로 건다 */
export async function requireAuth(request: FastifyRequest) {
  if (!request.user) throw unauthorized();
}

/** 운영진 전용 */
export async function requireAdmin(request: FastifyRequest) {
  if (!request.user) throw unauthorized();
  if (request.user.role !== '운영진') throw forbidden('운영진만 사용할 수 있습니다.');
}

export function setSessionCookie(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true, // 자바스크립트로 못 읽게 — XSS 로 토큰이 새는 걸 막는다
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14, // 2주
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
