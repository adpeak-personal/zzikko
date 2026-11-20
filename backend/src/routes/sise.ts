import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { notFound, parse } from '../lib/http.js';
import { requireAdmin } from '../lib/auth.js';
import { aiReady, logUsage } from '../lib/anthropic.js';
import { extractSheet } from '../lib/sise/extract.js';
import { fetchKeywordVolumes, keywordsReady } from '../lib/sise/keywords.js';
import { compareSheets } from '../lib/sise/compare.js';
import { defaultTitle, regionSlug, writeReport } from '../lib/sise/write.js';
import { saveBuffer } from '../lib/storage.js';
import { processImage } from '../lib/images.js';
import { readImage } from '../lib/multipart.js';
import * as sise from '../repositories/sise.js';
import type { SiseRow } from '../types.js';

/**
 * 시세 리포트 — SEO·GEO 용 글.
 *
 * 흐름: 이미지 업로드 → AI 가 표를 읽음 → 사람이 확인 → 저장 → 글 생성 → 발행.
 * 확인 단계를 빼지 않는 이유는, 표에서 숫자 하나를 잘못 읽으면 그대로 공개되기 때문이다.
 */

/**
 * 시세 지역은 **자유 문자열**이다 — '수원'·'부천'·'강남'처럼 시·구 단위까지 들어온다.
 * 검색량이 받쳐주는 지역으로 글을 써야 하기 때문이다("경기 휴대폰성지"는 거의 안 찾는다).
 * 회원·매장의 `Region`(8개 고정)과는 다른 개념이니 같이 묶지 말 것.
 */
const regionField = z.string().trim().min(1, '지역을 입력해주세요.').max(20);

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
  region: regionField,
  datedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식이 올바르지 않습니다.'),
  imageUrl: z.string().min(1).max(500),
  note: z.string().max(300).default(''),
  rows: z.array(rowSchema).min(1, '행이 비어 있습니다.').max(400),
});

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
    keywords: await sise.listKeywords(),
    keywordsReady: keywordsReady(),
  }));

  /* ── 지역 키워드 ──
   *
   * 어느 지역 글을 쓸지 고르는 목록. 네이버 검색광고 API 는 무료지만 호출 수 제한이
   * 있으므로 **버튼을 눌렀을 때만** 부른다 — 검색량은 자주 바뀌지 않는다.
   */

  app.post('/admin/sise/keywords/fetch', { preHandler: requireAdmin }, async (request) => {
    const hits = await fetchKeywordVolumes();
    const saved = await sise.upsertKeywords(hits);
    request.log.info({ saved }, '지역 키워드 검색량 갱신');
    return { saved, keywords: await sise.listKeywords() };
  });

  app.patch('/admin/sise/keywords/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(z.object({ id: z.coerce.number().int().positive() }), request.params);
    const { done } = parse(z.object({ done: z.boolean() }), request.body);
    if (!(await sise.setKeywordDone(id, done))) throw notFound('키워드');
    return { ok: true };
  });

  /** 쌓인 표시를 한 번에 푼다 — 다음 달에 다시 돌 때 */
  app.post('/admin/sise/keywords/clear', { preHandler: requireAdmin }, async () => ({
    cleared: await sise.clearKeywordsDone(),
  }));

  /**
   * 1단계 — 이미지를 올리고 표를 읽는다.
   *
   * 아직 저장하지 않는다. 읽어낸 행을 그대로 돌려주고, 사람이 화면에서 확인한 뒤
   * 2단계(POST /admin/sise/sheets)로 저장한다.
   */
  app.post('/admin/sise/extract', { preHandler: requireAdmin }, async (request) => {
    const image = await readImage(request, '시세표 이미지를 선택해주세요.');

    // 원본 그대로 읽힌다 — 표의 작은 숫자가 뭉개지면 안 되므로 줄이기 전에 넘긴다
    const draft = await extractSheet(image.data, image.mimetype);
    const readCost = logUsage(request, '시세표 읽기', draft.model, draft.usage);

    // 보관용은 webp 로 (EXIF 제거 + 용량)
    const processed = await processImage(image.data);
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
      region: input.region,
      datedOn: input.datedOn,
      imageUrl: input.imageUrl,
      rows,
      note: input.note,
      createdBy: request.user!.id,
    });

    const previous = await sise.findPreviousSheet(input.region, input.datedOn, sheetId);
    const comparison = previous ? compareSheets(rows, previous.rows) : null;

    const written = await writeReport({
      region: input.region,
      datedOn: input.datedOn,
      rows,
      note: input.note,
      comparison,
      previousDate: previous?.datedOn ?? null,
    });

    logUsage(request, '시세 글 작성', written.model, written.usage);

    const slug = await sise.uniqueSlug(`${regionSlug(input.region)}-${input.datedOn}`);
    const reportId = await sise.createReport({
      sheetId,
      slug,
      title: written.title || defaultTitle({ region: input.region, datedOn: input.datedOn }),
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
