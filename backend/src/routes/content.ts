import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound, parse } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';
import * as content from '../repositories/content.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });

const newsSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(120),
  category: z.string().trim().min(1).max(30),
  summary: z.string().trim().max(200).default(''),
  body: z.string().max(50_000).default(''),
  thumb: z.string().max(20).default('violet'),
  thumbUrl: z.string().max(500).nullable().optional(),
  author: z.string().trim().max(30).default('찍고 편집팀'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 입니다.'),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
});

const chipsetSchema = z.object({
  name: z.string().trim().min(1, '칩셋 이름을 입력해주세요.').max(40),
  maker: z.string().trim().min(1).max(20),
  tier: z.enum(['플래그십', '준플래그십', '중급', '보급형']),
  year: z.number().int().min(2000).max(2100),
});

const specSchema = z.object({
  name: z.string().trim().min(1, '기종 이름을 입력해주세요.').max(40),
  brand: z.enum(['Samsung', 'Apple', '기타']),
  releaseDate: z.string().regex(/^\d{4}-\d{2}$/, '출시는 YYYY-MM 형식입니다.'),
  retailPrice: z.number().int().min(0).max(10_000_000),
  chipsetId: z.number().int().positive().nullable().default(null),

  display: z.string().max(80).default(''),
  storage: z.string().max(60).default(''),
  battery: z.string().max(40).default(''),
  charging: z.string().max(60).default(''),
  cameraMain: z.string().max(80).default(''),
  cameraFront: z.string().max(60).default(''),
  weight: z.string().max(20).default(''),

  // 0 이면 그 항목은 비교에서 빠진다
  displayInch: z.number().min(0).max(20).default(0),
  refreshHz: z.number().int().min(0).max(1000).default(0),
  memoryGb: z.number().int().min(0).max(1024).default(0),
  batteryMah: z.number().int().min(0).max(30000).default(0),
  chargingWatt: z.number().int().min(0).max(1000).default(0),
  cameraMainMp: z.number().int().min(0).max(100000).default(0),
  weightG: z.number().int().min(0).max(2000).default(0),

  thumb: z.string().max(20).default('violet'),
  thumbUrl: z.string().max(500).nullable().optional(),
  published: z.boolean().default(true),
});

export default async function contentRoutes(app: FastifyInstance) {
  /* ── 공개 조회 ── */

  app.get('/news', async (request) => {
    const { category } = parse(z.object({ category: z.string().max(30).optional() }), request.query);
    return { items: await content.listNews({ category }) };
  });

  app.get('/news/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const article = await content.getNews(id);
    // 미발행 기사는 없는 것으로 본다
    if (!article || !article.published) throw notFound('기사');
    return article;
  });

  app.get('/specs', async () => ({
    items: await content.listSpecs(),
    chipsets: await content.listChipsets(),
  }));

  app.get('/specs/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const spec = await content.getSpec(id);
    if (!spec || !spec.published) throw notFound('기종');
    return spec;
  });

  app.get('/chipsets', async () => ({ items: await content.listChipsets() }));

  /* ── 어드민 ── */

  app.get('/admin/news', { preHandler: requireAdmin }, async () => ({ items: await content.listNews({ all: true }) }));

  app.post('/admin/news', { preHandler: requireAdmin }, async (request, reply) => {
    const id = await content.createNews(parse(newsSchema, request.body));
    return reply.code(201).send(await content.getNews(id));
  });

  app.patch('/admin/news/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    if (!(await content.getNews(id))) throw notFound('기사');
    await content.updateNews(id, parse(newsSchema, request.body));
    return content.getNews(id);
  });

  app.delete('/admin/news/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    await content.deleteNews(id);
    return { ok: true };
  });

  app.get('/admin/specs', { preHandler: requireAdmin }, async () => ({
    items: await content.listSpecs({ all: true }),
    chipsets: await content.listChipsets(),
  }));

  app.post('/admin/specs', { preHandler: requireAdmin }, async (request, reply) => {
    const id = await content.createSpec(parse(specSchema, request.body));
    return reply.code(201).send(await content.getSpec(id));
  });

  app.patch('/admin/specs/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    if (!(await content.getSpec(id))) throw notFound('기종');
    await content.updateSpec(id, parse(specSchema, request.body));
    return content.getSpec(id);
  });

  app.delete('/admin/specs/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    await content.deleteSpec(id);
    return { ok: true };
  });

  app.post('/admin/chipsets', { preHandler: requireAdmin }, async (request, reply) => {
    const id = await content.createChipset(parse(chipsetSchema, request.body));
    return reply.code(201).send({ id });
  });

  app.patch('/admin/chipsets/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    await content.updateChipset(id, parse(chipsetSchema, request.body));
    return { ok: true };
  });

  app.delete('/admin/chipsets/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    // FK 로도 막히지만, 먼저 확인해서 알아들을 수 있는 메시지를 준다
    const used = await content.countSpecsUsingChipset(id);
    if (used > 0) throw badRequest(`이 칩셋을 쓰는 기종이 ${used}개 있어 지울 수 없습니다.`);
    await content.deleteChipset(id);
    return { ok: true };
  });
}
