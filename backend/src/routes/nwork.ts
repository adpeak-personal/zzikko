import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound, parse } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';
import * as nwork from '../repositories/nwork.js';

/* 네이버 작업 계정 — 전부 운영진 전용 */

const idParam = z.object({ id: z.coerce.number().int().positive() });

const boolParam = z.enum(['1', '0']).transform((value) => value === '1');

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.string().trim().max(20).optional(),
  usable: boolParam.optional(),
  working: boolParam.optional(),
  page: z.coerce.number().int().min(1).default(1),
  size: z.coerce.number().int().min(10).max(200).default(50),
});

// 컬럼 길이에 맞춘다 (n_id 100 · n_pwd 100 · 메모 255 · task_role 20)
const role = z.string().trim().min(1, '용도를 입력해주세요.').max(20);
const accountBase = {
  loginId: z.string().trim().min(1, '아이디를 입력해주세요.').max(100),
  memo1: z.string().max(255).default(''),
  memo2: z.string().max(255).default(''),
  memo3: z.string().max(255).default(''),
  usable: z.boolean().default(true),
  role: role.default('미사용'),
  working: z.boolean().default(false),
};

const createSchema = z.object({ ...accountBase, password: z.string().min(1, '비밀번호를 입력해주세요.').max(100) });
// 수정할 때 비밀번호는 바꿀 때만 보낸다
const updateSchema = z.object({ ...accountBase, password: z.string().max(100).optional() });

const bulkSchema = z
  .object({
    ids: z.array(z.number().int().positive()).min(1, '계정을 선택해주세요.').max(1000),
    role: role.optional(),
    usable: z.boolean().optional(),
    working: z.boolean().optional(),
  })
  .refine((v) => v.role !== undefined || v.usable !== undefined || v.working !== undefined, '바꿀 항목을 골라주세요.');

const importSchema = z.object({
  // 한 줄에 하나: 아이디|비밀번호|메모 (메모는 없어도 된다)
  text: z.string().max(200_000),
  role: role.default('미사용'),
});

export default async function nworkRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAdmin);

  app.get('/admin/nwork', async (request) => {
    const filter = parse(listQuery, request.query);
    const [list, summary] = await Promise.all([nwork.listAccounts(filter), nwork.summary()]);
    return { ...list, summary };
  });

  app.get('/admin/nwork/:id/password', async (request) => {
    const { id } = parse(idParam, request.params);
    const password = await nwork.getPassword(id);
    if (password === null) throw notFound('계정');
    request.log.info({ nworkId: id, adminId: request.user!.id }, 'nwork 비밀번호 조회');
    return { password };
  });

  app.post('/admin/nwork', async (request, reply) => {
    const input = parse(createSchema, request.body);
    if (await nwork.loginIdTaken(input.loginId)) throw badRequest('이미 등록된 아이디입니다.');
    const id = await nwork.createAccount(input);
    return reply.code(201).send(await nwork.getAccount(id));
  });

  app.patch('/admin/nwork/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const input = parse(updateSchema, request.body);
    if (!(await nwork.getAccount(id))) throw notFound('계정');
    if (await nwork.loginIdTaken(input.loginId, id)) throw badRequest('이미 등록된 아이디입니다.');
    await nwork.updateAccount(id, input);
    return nwork.getAccount(id);
  });

  app.post('/admin/nwork/bulk', async (request) => {
    const { ids, ...patch } = parse(bulkSchema, request.body);
    return { updated: await nwork.bulkUpdate(ids, patch) };
  });

  app.post('/admin/nwork/import', async (request) => {
    const { text, role: importRole } = parse(importSchema, request.body);
    const rows: { loginId: string; password: string; memo1: string }[] = [];
    const errors: string[] = [];
    text.split(/\r?\n/).forEach((raw, index) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const [loginId = '', password = '', ...rest] = line.split('|').map((part) => part.trim());
      if (!loginId || !password) return errors.push(`${index + 1}번째 줄: 아이디|비밀번호 형식이 아닙니다.`);
      if (loginId.length > 100 || password.length > 100) return errors.push(`${index + 1}번째 줄: 너무 깁니다.`);
      rows.push({ loginId, password, memo1: rest.join(' | ').slice(0, 255) });
    });
    if (errors.length) throw badRequest(errors.slice(0, 5).join(' / ') + (errors.length > 5 ? ` 외 ${errors.length - 5}건` : ''));
    if (!rows.length) throw badRequest('추가할 줄이 없습니다.');
    return nwork.importAccounts(rows, importRole);
  });

  app.delete('/admin/nwork/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    await nwork.deleteAccount(id);
    return { ok: true };
  });
}
