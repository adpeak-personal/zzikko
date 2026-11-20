import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest, notFound, parse } from '../lib/http.js';
import { isAdmin, requireAdmin } from '../lib/auth.js';
import * as content from '../repositories/content.js';
import * as feed from '../repositories/newsFeed.js';
import { SOURCES, fetchSource } from '../lib/news/feed.js';
import { translateTitles } from '../lib/news/translate.js';
import { writeArticle } from '../lib/news/write.js';
import { extractSpec } from '../lib/specs/extract.js';
import { readImage } from '../lib/multipart.js';
import { buildPairs, pairSlug } from '../lib/specs/pairs.js';
import { aiReady, logUsage } from '../lib/anthropic.js';

const idParam = z.object({ id: z.coerce.number().int().positive() });

const newsSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해주세요.').max(120),
  category: z.string().trim().min(1).max(30),
  summary: z.string().trim().max(200).default(''),
  body: z.string().max(50_000).default(''),
  thumb: z.string().max(20).default('violet'),
  // 사진은 순서가 의미를 가진다(첫 장이 목록 카드에 쓰인다). thumbUrl 은 서버가 여기서 만든다.
  images: z
    .array(z.object({ url: z.string().trim().min(1).max(500), caption: z.string().trim().max(200).default('') }))
    .max(8)
    .default([]),
  // 출처 표기가 이용 조건이라 퍼온 기사에는 반드시 들어간다 (직접 쓴 글이면 비운다)
  sourceName: z.string().trim().max(60).nullable().optional(),
  sourceUrl: z.string().trim().max(500).nullable().optional(),
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
  // 사진은 순서가 의미를 가진다(첫 장이 목록 카드에 쓰인다). thumbUrl 은 서버가 여기서 만든다.
  images: z
    .array(z.object({ url: z.string().trim().min(1).max(500), caption: z.string().trim().max(200).default('') }))
    .max(8)
    .default([]),
  published: z.boolean().default(true),
});

/**
 * 칩셋 이름 맞춰보기.
 *
 * 삼성은 같은 칩을 늘 "Snapdragon 8 Gen 5 **for Galaxy**" 로 적는다. 글자 그대로 비교하면
 * 삼성 플래그십은 하나도 안 맞아서 매번 손으로 고르게 된다.
 *
 * 그렇다고 부분 일치로 풀면 안 된다 — "A19" 가 "A19 Pro" 에 걸려 다른 칩이 선택된다
 * (등급이 달라 비교표의 우열이 뒤집힌다). 붙는 수식어만 떼고 나머지는 정확히 맞춘다.
 */
const normalizeChipset = (name: string) =>
  name
    .toLowerCase()
    .replace(/\bfor galaxy\b/g, '')
    .replace(/\bchip\b/g, '')
    .replace(/[\s-]+/g, ' ')
    .trim();

const sameChipset = (a: string, b: string) => normalizeChipset(a) === normalizeChipset(b);

export default async function contentRoutes(app: FastifyInstance) {
  /* ── 공개 조회 ── */

  app.get('/news', async (request) => {
    const { category } = parse(z.object({ category: z.string().max(30).optional() }), request.query);
    return { items: await content.listNews({ category }) };
  });

  app.get('/news/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const article = await content.getNews(id);
    if (!article) throw notFound('기사');
    // 미발행 기사는 없는 것으로 본다. 운영진만 발행 전에 실제 화면을 확인할 수 있다 —
    // 퍼온 기사는 한 번 읽고 내보내는 흐름이라, 날 텍스트만 보고 판단하게 두면 안 된다.
    if (!article.published && !(await isAdmin(request))) throw notFound('기사');
    return article;
  });

  app.get('/specs', async () => ({
    items: await content.listSpecs(),
    chipsets: await content.listChipsets(),
  }));

  app.get('/specs/:id', async (request) => {
    const { id } = parse(idParam, request.params);
    const spec = await content.getSpec(id);
    if (!spec) throw notFound('기종');
    if (!spec.published && !(await isAdmin(request))) throw notFound('기종');
    return spec;
  });

  app.get('/chipsets', async () => ({ items: await content.listChipsets() }));

  /* ── 어드민 ── */

  /* ── 뉴스 수집함 ──
   *
   * 흐름: 수집(RSS) → 어드민에서 고르기 → 기사 생성(미발행) → 검수 후 발행.
   * 자동으로 발행까지 가지 않는다 — 퍼온 기사는 사람이 한 번 읽고 내보내야 한다.
   */

  app.get('/admin/news/feed', { preHandler: requireAdmin }, async (request) => {
    const { status } = parse(
      z.object({ status: z.enum(['수집', '작성됨', '숨김', '삭제']).optional() }),
      request.query,
    );
    return {
      items: await feed.listFeed(status),
      counts: await feed.countByStatus(),
      sources: SOURCES.map((item) => item.name),
      aiReady: aiReady(),
    };
  });

  app.post('/admin/news/feed/fetch', { preHandler: requireAdmin }, async (request) => {
    const saved: { id: number; title: string }[] = [];
    const failed: string[] = [];
    for (const source of SOURCES) {
      try {
        saved.push(...(await feed.saveItems(await fetchSource(source), source.name)));
      } catch (err) {
        request.log.warn({ err, source: source.name }, '뉴스 수집 실패');
        failed.push(source.name);
      }
    }

    /*
     * 제목을 한국어로 옮긴다.
     *
     * 방금 담은 것만이 아니라 **아직 안 옮긴 것까지** 같이 한다 — 그러지 않으면
     * 이 기능을 넣기 전에 쌓인 항목이 영영 영어로 남는다.
     *
     * 목록에서 어떤 소식인지 바로 알아보려는 것이지 기사 본문과는 상관없다 —
     * 기사는 번역이 아니라 사실만 골라 새로 쓴다(lib/news/write.ts).
     * 실패하면 원문 제목이 그대로 남을 뿐이라 수집을 막지 않는다.
     */
    const pending = await feed.listUntranslated();
    if (pending.length > 0) {
      const translated = await translateTitles(
        pending.map((item) => item.title),
        (message) => request.log.warn(message),
      );
      logUsage(request, '제목 번역', translated.model, translated.usage);
      for (const [index, item] of pending.entries()) {
        const title = translated.titles[index];
        // 못 옮긴 건 적지 않는다 — 적어 두면 다음에 다시 시도하지 못한다
        if (title && title !== item.title) await feed.setTitleKo(item.id, title);
      }
    }

    // 원문은 기사를 쓸 때만 쓰므로 오래된 건 비워 둔다 (행은 남겨야 또 안 받는다)
    await feed.trimOldSources();
    return { added: saved.length, failed };
  });

  /** 고른 항목으로 기사 초안을 만든다. 미발행으로 들어간다. */
  app.post('/admin/news/feed/:id/write', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parse(idParam, request.params);
    const item = await feed.getWithSource(id);
    if (!item) throw notFound('수집 항목');
    if (!item.sourceText.trim()) throw badRequest('원문이 남아 있지 않습니다. 다시 수집해주세요.');

    const written = await writeArticle({
      title: item.title,
      sourceText: item.sourceText,
      sourceName: item.sourceName,
    });
    logUsage(request, '뉴스 기사 작성', written.model, written.usage);

    const articleId = await content.createNews({
      title: written.title,
      category: written.category,
      summary: written.summary,
      body: written.body,
      thumb: 'violet',
      // 사진은 사람이 어드민에서 붙인다 — 원문 이미지는 출처 쪽 권리라 가져오지 않는다
      images: [],
      // 출처 표기는 선택이 아니다 — 퍼온 기사의 이용 조건이다
      sourceName: item.sourceName,
      sourceUrl: item.link,
      author: '찍고 편집팀',
      date: item.publishedAt.slice(0, 10),
      featured: false,
      published: false,
    });
    await feed.markWritten(id, articleId);

    return reply.code(201).send({ article: await content.getNews(articleId), relevance: written.relevance });
  });

  app.patch('/admin/news/feed/:id', { preHandler: requireAdmin }, async (request) => {
    const { id } = parse(idParam, request.params);
    const { status } = parse(z.object({ status: z.enum(['수집', '작성됨', '숨김', '삭제']) }), request.body);
    if (!(await feed.getWithSource(id))) throw notFound('수집 항목');
    await feed.setStatus(id, status);
    return { ok: true };
  });

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

  /**
   * 사양 자료를 붙여넣으면 칸에 맞춰 정리해 돌려준다. **저장하지 않는다** —
   * 못 채운 항목이 있을 수 있어 어드민에서 사람이 확인한 뒤 등록한다.
   *
   * 제조사 사양 페이지는 대부분 JS 로 그려져 서버가 직접 긁으면 안 나온다.
   * 그래서 주소를 받지 않고 붙여넣은 글(또는 캡처)을 받는다.
   */
  /**
   * 제조사 사양을 읽어 칸에 맞춰 돌려준다. **저장하지 않는다.**
   *
   * 붙여넣은 글(JSON)과 사양 화면 캡처(멀티파트) 둘 다 받는다 —
   * 제조사 사양 페이지는 JS 로 그려져서 긁어도 안 나오는데, 사람이 보고 있는 화면은
   * 복사가 되기도 하고 안 되기도 한다.
   */
  app.post('/admin/specs/extract', { preHandler: requireAdmin }, async (request) => {
    const out = request.isMultipart()
      ? await extractSpec({ image: await readImage(request, '사양 캡처 이미지를 선택해주세요.') })
      : await extractSpec(parse(z.object({ text: z.string().min(10, '사양 자료를 넣어주세요.').max(40_000) }), request.body));

    const usd = logUsage(request, '사양 정리', out.model, out.usage);

    // 칩셋 이름이 잡혔으면 이미 등록된 것과 맞춰 본다
    const chipsets = await content.listChipsets();
    const matched = out.chipsetName ? chipsets.find((item) => sameChipset(item.name, out.chipsetName)) : undefined;

    return {
      spec: {
        name: out.name,
        brand: out.brand,
        releaseDate: out.releaseDate,
        retailPrice: out.retailPrice,
        chipsetId: matched?.id ?? null,
        display: out.display,
        storage: out.storage,
        battery: out.battery,
        charging: out.charging,
        cameraMain: out.cameraMain,
        cameraFront: out.cameraFront,
        weight: out.weight,
        displayInch: out.displayInch,
        refreshHz: out.refreshHz,
        memoryGb: out.memoryGb,
        batteryMah: out.batteryMah,
        chargingWatt: out.chargingWatt,
        cameraMainMp: out.cameraMainMp,
        weightG: out.weightG,
      },
      missing: out.missing,
      // 칩셋 이름은 읽었는데 등록된 게 없을 때 알려 준다
      unknownChipset: out.chipsetName && !matched ? out.chipsetName : null,
      usd,
    };
  });

  /** 비교 페이지로 만들 짝 목록 — 프론트가 주소를 만들 때 쓴다 */
  app.get('/compare', async () => {
    const [specs, chipsets] = await Promise.all([content.listSpecs(), content.listChipsets()]);
    return {
      items: buildPairs(specs).map((pair) => ({
        slug: pairSlug(pair.a, pair.b),
        reason: pair.reason,
        a: pair.a,
        b: pair.b,
      })),
      chipsets,
    };
  });

  app.get('/compare/:slug', async (request) => {
    const { slug } = parse(z.object({ slug: z.string().max(200) }), request.params);
    const [specs, chipsets] = await Promise.all([content.listSpecs(), content.listChipsets()]);
    const pair = buildPairs(specs).find((item) => pairSlug(item.a, item.b) === slug);
    if (!pair) throw notFound('비교');
    return { a: pair.a, b: pair.b, reason: pair.reason, chipsets };
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
