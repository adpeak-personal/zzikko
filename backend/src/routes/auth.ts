import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, parse, unauthorized } from '../lib/http.js';
import { clearSessionCookie, hashPassword, requireAuth, setSessionCookie, verifyPassword } from '../lib/auth.js';
import * as users from '../repositories/users.js';

const REGIONS = ['서울', '경기·인천', '부산', '대구', '대전', '광주', '강원', '제주'] as const;

/** 닉네임 첫 글자 아바타에 쓸 색 — 가입할 때 하나 골라준다 */
const AVATAR_COLORS = ['#fa6038', '#2f6f5e', '#1f6feb', '#7b5ea7', '#c2410c', '#0f766e', '#b45309', '#be123c'];

const signupSchema = z.object({
  email: z.email('이메일 형식이 아닙니다.'),
  // 짧은 비밀번호를 막는다. 복잡도 규칙은 외우기 어렵게만 만들어서 길이로 간다.
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.').max(72),
  nickname: z.string().trim().min(2, '닉네임은 2자 이상이어야 합니다.').max(30),
  region: z.enum(REGIONS).optional(),
});

const loginSchema = z.object({
  email: z.email('이메일 형식이 아닙니다.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/signup', async (request, reply) => {
    const input = parse(signupSchema, request.body);

    if (await users.emailTaken(input.email)) throw badRequest('이미 가입된 이메일입니다.');
    if (await users.nicknameTaken(input.nickname)) throw badRequest('이미 쓰고 있는 닉네임입니다.');

    const id = await users.createUser({
      email: input.email,
      passwordHash: await hashPassword(input.password),
      nickname: input.nickname,
      region: input.region ?? '서울',
      avatarColor: AVATAR_COLORS[id_seed(input.nickname) % AVATAR_COLORS.length]!,
    });

    const row = (await users.findById(id))!;
    setSessionCookie(reply, app.jwt.sign({ id: row.id, nickname: row.nickname, role: row.role }));
    return reply.code(201).send(users.toMe(row));
  });

  app.post('/auth/login', async (request, reply) => {
    const input = parse(loginSchema, request.body);

    const row = await users.findByEmail(input.email);
    // 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분해서 알려주지 않는다 (계정 존재 여부 유출 방지)
    if (!row || !(await verifyPassword(input.password, row.password_hash))) {
      throw unauthorized('이메일 또는 비밀번호가 맞지 않습니다.');
    }

    setSessionCookie(reply, app.jwt.sign({ id: row.id, nickname: row.nickname, role: row.role }));
    return users.toMe(row);
  });

  app.post('/auth/logout', async (_request, reply) => {
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    const row = await users.findById(request.user!.id);
    if (!row) throw unauthorized();
    return users.toMe(row);
  });
}

/** 닉네임으로 아바타 색을 고정한다 — 같은 사람은 늘 같은 색 */
function id_seed(text: string) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash;
}
