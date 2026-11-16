import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound, parse, tooManyRequests } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';
import * as applications from '../repositories/sellerApplications.js';

/**
 * 판매자 입점 신청.
 *
 * POST 는 로그인 없이 누구나 부를 수 있다 (아직 회원이 아닌 판매자가 쓰는 창구라서).
 * 그래서 아래 두 가지로 도배를 막는다.
 *  - 같은 IP 에서 짧은 시간에 여러 번 → 429
 *  - 같은 번호로 24시간 안에 다시 → 새로 만들지 않고 "이미 접수됨"으로 응답
 */

const REGIONS = ['서울', '경기·인천', '부산', '대구', '대전', '광주', '강원', '제주'] as const;
const CARRIERS = ['SKT', 'KT', 'LG U+', '알뜰폰'] as const;
const STATUSES = ['신청', '연락중', '승인', '보류'] as const;

const applySchema = z.object({
  shopName: z.string().trim().min(1, '매장 이름을 입력해주세요.').max(60),
  manager: z.string().trim().min(1, '담당자 이름을 입력해주세요.').max(30),
  phone: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^0-9]/g, ''))
    .refine((value) => value.length >= 9 && value.length <= 11, '연락처를 다시 확인해주세요.'),
  region: z.enum(REGIONS),
  area: z.string().trim().max(60).optional(),
  carriers: z.array(z.enum(CARRIERS)).max(4).default([]),
  channel: z.string().trim().max(30).optional(),
  message: z.string().trim().max(1000).optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

const patchSchema = z.object({
  status: z.enum(STATUSES).optional(),
  memo: z.string().max(2000).nullable().optional(),
});

/* ── IP 당 제한 — 프로세스 메모리에만 둔다 ──
   재시작하면 비워지고 여러 대로 늘리면 제각각이 되지만, 지금은 한 대라 이걸로 충분하다.
   더 엄해져야 하면 Redis 나 @fastify/rate-limit 으로 옮긴다. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function overLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  // 오래된 IP 는 버린다 — 안 그러면 Map 이 계속 커진다
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((at) => now - at >= WINDOW_MS)) hits.delete(key);
    }
  }

  return recent.length > MAX_PER_WINDOW;
}

export default async function sellerRoutes(app: FastifyInstance) {
  app.post('/seller-applications', async (request, reply) => {
    if (overLimit(request.ip)) throw tooManyRequests('잠시 후 다시 시도해주세요.');

    const input = parse(applySchema, request.body);

    // 두 번 눌렀거나 다시 보낸 경우 — 중복을 쌓지 않고 접수된 것으로 응답한다
    const existing = await applications.findRecentByPhone(input.phone);
    if (existing) return reply.code(200).send({ id: existing.id, duplicated: true });

    const id = await applications.createApplication(input);
    request.log.info({ id, shopName: input.shopName }, '판매자 입점 신청');
    return reply.code(201).send({ id, duplicated: false });
  });

  /* ── 어드민 ── */

  app.get('/admin/seller-applications', { preHandler: requireAdmin }, async (request) => {
    const { status } = parse(z.object({ status: z.enum(STATUSES).optional() }), request.query);
    const [items, counts] = await Promise.all([applications.listApplications(status), applications.countByStatus()]);
    return { items, counts };
  });

  app.patch('/admin/seller-applications/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    if (!(await applications.getApplication(id))) throw notFound('신청');
    await applications.updateApplication(id, parse(patchSchema, request.body));
    return applications.getApplication(id);
  });

  app.delete('/admin/seller-applications/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    await applications.deleteApplication(id);
    return { ok: true };
  });
}
