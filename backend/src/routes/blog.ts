import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound, parse } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';
import * as profiles from '../repositories/blogProfiles.js';

/**
 * 블로그 작업 프로필 — 전부 운영진 전용.
 *
 * ⚠️ `/admin/blog/runner` 는 **계정 비밀번호와 프록시 비밀번호를 그대로 내려준다.**
 * 작업기(py)가 로그인을 대신해야 해서 어쩔 수 없다. 그래서 이 길은
 * 운영진 세션으로만 열리고, 어드민 화면은 절대 부르지 않는다(브라우저로 새면 안 된다).
 */
const idParam = z.object({ id: z.coerce.number().int().positive() });

const profileBase = {
  // 크롬 프로필 폴더 이름이 되므로 경로에 못 쓰는 글자는 막는다
  name: z
    .string()
    .trim()
    .min(1, '이름을 입력해주세요.')
    .max(100)
    .regex(/^[A-Za-z0-9._-]+$/, '영문·숫자와 . _ - 만 쓸 수 있어요 (폴더 이름이 됩니다).'),
  proxyHost: z.string().trim().max(120).default(''),
  proxyPort: z.coerce.number().int().min(1).max(65535).nullable().default(null),
  proxyUser: z.string().trim().max(100).default(''),
  userAgent: z.string().trim().max(255).default(''),
  note: z.string().trim().max(255).default(''),
  active: z.boolean().default(true),
};

const createSchema = z.object({ ...profileBase, proxyPass: z.string().max(100).default('') });
// 수정할 땐 비밀번호를 보낼 때만 바꾼다
const updateSchema = z.object({ ...profileBase, proxyPass: z.string().max(100).optional() });

export default async function blogRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  app.get('/admin/blog/profiles', async () => ({ items: await profiles.listProfiles() }));

  app.post('/admin/blog/profiles', async (request, reply) => {
    const input = parse(createSchema, request.body);
    try {
      const id = await profiles.createProfile(input);
      return reply.code(201).send({ id });
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw badRequest('이미 있는 프로필 이름입니다.');
      throw error;
    }
  });

  app.patch('/admin/blog/profiles/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const row = await profiles.findProfile(id);
    if (!row) throw notFound('프로필');

    const input = parse(updateSchema, request.body);
    try {
      await profiles.updateProfile(id, row.name, input);
    } catch (error) {
      if ((error as { code?: string }).code === 'ER_DUP_ENTRY') throw badRequest('이미 있는 프로필 이름입니다.');
      throw error;
    }
    return { ok: true };
  });

  app.delete('/admin/blog/profiles/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const row = await profiles.findProfile(id);
    if (!row) throw notFound('프로필');
    // 계정은 지우지 않는다 — 프로필만 떼어 낸다
    await profiles.deleteProfile(id, row.name);
    return { ok: true };
  });

  /* ── 작업기(py)가 쓰는 길 ── */

  /** 돌릴 프로필과 계정(비밀번호 포함). `?profile=prof-01` 로 하나만 받을 수도 있다 */
  app.get('/admin/blog/runner', async (request) => {
    const { profile } = parse(z.object({ profile: z.string().trim().max(100).optional() }), request.query);
    return { items: await profiles.runnerBundle(profile) };
  });

  /** 로그인 결과 보고. 실패하면 그 계정이 '쓸 수 없음'으로 내려간다 */
  app.post('/admin/blog/login-result', async (request) => {
    const input = parse(
      z.object({
        accountId: z.number().int().positive(),
        ok: z.boolean(),
        /** 통한 프로필 이름 — 보내면 프로필의 '마지막 성공'도 갱신한다 */
        profile: z.string().trim().max(100).optional(),
      }),
      request.body,
    );
    if (!(await profiles.reportLogin(input.accountId, input.ok))) throw notFound('계정');
    if (input.ok && input.profile) await profiles.markProfileOk(input.profile);
    return { ok: true };
  });
}
