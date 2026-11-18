import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound, parse } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';
import { aiReady, logUsage } from '../lib/anthropic.js';
import { extractSheet } from '../lib/sise/extract.js';
import { compareSheets } from '../lib/sise/compare.js';
import { REGION_SLUG, defaultTitle, writeReport } from '../lib/sise/write.js';
import { saveBuffer } from '../lib/storage.js';
import { processImage } from '../lib/images.js';
import * as sise from '../repositories/sise.js';
import type { Region, SiseRow } from '../types.js';

/**
 * 시세 리포트 — SEO·GEO 용 글.
 *
 * 흐름: 이미지 업로드 → AI 가 표를 읽음 → 사람이 확인 → 저장 → 글 생성 → 발행.
 * 확인 단계를 빼지 않는 이유는, 표에서 숫자 하나를 잘못 읽으면 그대로 공개되기 때문이다.
 */

const REGIONS = ['서울', '경기·인천', '부산', '대구', '대전', '광주', '강원', '제주'] as const;

const rowSchema = z.object({
  series: z.string().max(40).default(''),
  model: z.string().trim().min(1).max(60),
  storage: z.string().max(20).default(''),
  carrier: z.enum(['SKT', 'KT', 'LG U+', '알뜰폰']),
  plan: z.string().max(40).default(''),
  joinType: z.enum(['번호이동', '기기변경', '신규가입']),
  price: z.number().int().min(-200).max(500),
});

const saveSchema = z.object({
  region: z.enum(REGIONS),
  datedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.'),
  imageUrl: z.string().min(1).max(500),
  note: z.string().max(300).default(''),
  rows: z.array(rowSchema).min(1, '행이 비어 있습니다.').max(400),
});

const MAX_BYTES = 10 * 1024 * 1024;

async function readAll(stream: AsyncIterable<Buffer>, limit: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.byteLength;
    if (total > limit) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export default async function siseRoutes(app: FastifyInstance) {
  /* ── 공개 ── */

  app.get('/sise', async () => ({ items: await sise.listReports({ publishedOnly: true, limit: 100 }) }));

  app.get('/sise/:slug', async (request) => {
    const { slug } = parse(z.object({ slug: z.string().max(120) }), request.params);
    const report = await sise.getPublishedReport(slug);
    if (!report) throw notFound('시세 리포트');
    await sise.increaseViews(report.id);
    return report;
  });

  /* ── 어드민 ── */

  app.get('/admin/sise', { preHandler: requireAdmin }, async () => ({
    items: await sise.listReports({ publishedOnly: false }),
    aiReady: aiReady(),
    regions: REGIONS,
  }));

  /**
   * 1단계 — 이미지를 올리고 표를 읽는다.
   *
   * 아직 저장하지 않는다. 읽어낸 행을 그대로 돌려주고, 사람이 화면에서 확인한 뒤
   * 2단계(POST /admin/sise/sheets)로 저장한다.
   */
  app.post('/admin/sise/extract', { preHandler: requireAdmin }, async (request) => {
    const file = await request.file();
    if (!file) throw badRequest('시세표 이미지를 선택해주세요.');
    if (!file.mimetype.startsWith('image/')) throw badRequest('이미지 파일만 올릴 수 있습니다.');

    const input = await readAll(file.file, MAX_BYTES);
    if (!input || file.file.truncated) throw badRequest('이미지는 10MB 까지 올릴 수 있습니다.');

    // 원본 그대로 읽힌다 — 표의 작은 숫자가 뭉개지면 안 되므로 줄이기 전에 넘긴다
    const draft = await extractSheet(input, file.mimetype);
    const readCost = logUsage(request, '시세표 읽기', draft.model, draft.usage);

    // 보관용은 webp 로 (EXIF 제거 + 용량)
    const processed = await processImage(input);
    const saved = await saveBuffer(`sise/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.webp`, processed.body, 'image/webp');

    return { imageUrl: saved.url, note: draft.note, rows: draft.rows, usd: readCost };
  });

  /**
   * 2단계 — 사람이 확인한 행을 저장하고 글까지 만든다.
   *
   * 직전 시세표를 찾아 견준 뒤 해설을 쓴다. 미발행 상태로 들어간다.
   */
  app.post('/admin/sise/sheets', { preHandler: requireAdmin }, async (request, reply) => {
    const input = parse(saveSchema, request.body);
    const rows = input.rows as SiseRow[];

    const sheetId = await sise.createSheet({
      region: input.region as Region,
      datedOn: input.datedOn,
      imageUrl: input.imageUrl,
      rows,
      note: input.note,
      createdBy: request.user!.id,
    });

    const previous = await sise.findPreviousSheet(input.region, input.datedOn, sheetId);
    const comparison = previous ? compareSheets(rows, previous.rows) : null;

    const written = await writeReport({
      region: input.region as Region,
      datedOn: input.datedOn,
      rows,
      note: input.note,
      comparison,
      previousDate: previous?.datedOn ?? null,
    });

    logUsage(request, '시세 글 작성', written.model, written.usage);

    const slug = await sise.uniqueSlug(`${REGION_SLUG[input.region as Region]}-${input.datedOn}`);
    const reportId = await sise.createReport({
      sheetId,
      slug,
      title: written.title || defaultTitle({ region: input.region as Region, datedOn: input.datedOn }),
      summary: written.summary,
      sections: { lead: written.lead, highlights: written.highlights, closing: written.closing },
      changes: comparison?.changes ?? [],
      comparedTo: previous?.id ?? null,
    });

    return reply.code(201).send(await sise.getReport(reportId));
  });

  /** 글 다듬기 · 발행 · 내림 */
  app.patch('/admin/sise/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), request.params);
    const patch = parse(
      z.object({
        title: z.string().trim().min(1).max(200).optional(),
        summary: z.string().trim().max(300).optional(),
        sections: z
          .object({
            lead: z.string().max(4000),
            highlights: z.array(z.string().max(500)).max(10),
            closing: z.string().max(4000),
          })
          .optional(),
        published: z.boolean().optional(),
      }),
      request.body,
    );

    if (!(await sise.getReport(id))) throw notFound('시세 리포트');
    await sise.updateReport(id, patch);
    return sise.getReport(id);
  });

  app.delete('/admin/sise/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), request.params);
    if (!(await sise.deleteReport(id))) throw notFound('시세 리포트');
    return reply.code(204).send();
  });
}
