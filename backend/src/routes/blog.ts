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
  /** 이 프로필일 때 밖에서 보여야 할 IP. 비우면 작업기가 처음 성공했을 때 적어 넣는다 */
  expectedIp: z
    .string()
    .trim()
    .max(45)
    .regex(/^$|^[0-9a-fA-F.:]+$/, 'IP 주소만 넣어주세요.')
    .default(''),
  vpnLocation: z.string().trim().max(100).default(''),
  active: z.boolean().default(true),
};

/**
 * 프록시는 주소와 포트가 같이 있어야 한다.
 *
 * ⚠️ 주소만 적고 포트를 비우면 브라우저가 그 주소를 프록시로 알고 접속하다 실패해
 * **아무 데도 못 간다.** 화면에서는 "IP 칸" 처럼 보여서, 자기 IP 를 적어 넣기 쉽다.
 */
const needsPort = <T extends { proxyHost: string; proxyPort: number | null }>(schema: z.ZodType<T>) =>
  schema.refine((v) => !v.proxyHost || v.proxyPort !== null, {
    path: ['proxyPort'],
    message: '프록시 주소를 적었으면 포트도 넣어주세요. (내 IP 로 그냥 나가려면 주소를 비웁니다)',
  });

const createSchema = needsPort(z.object({ ...profileBase, proxyPass: z.string().max(100).default('') }));
// 수정할 땐 비밀번호를 보낼 때만 바꾼다
const updateSchema = needsPort(z.object({ ...profileBase, proxyPass: z.string().max(100).optional() }));

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

  /**
   * 작업기가 브라우저에서 잰 IP 를 적어 둔다 (비어 있을 때만).
   * 손으로 적다 오타가 나면 그 프로필이 통째로 멈추기 때문이다.
   */
  app.post('/admin/blog/profiles/:id/ip', async (request) => {
    const { id } = parse(idParam, request.params);
    const row = await profiles.findProfile(id);
    if (!row) throw notFound('프로필');
    const { ip } = parse(z.object({ ip: z.string().trim().min(1).max(45) }), request.body);
    return { recorded: await profiles.recordIpIfEmpty(row.name, ip) };
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
