// AI 블로그 제목 생성 라우트
//
// POST /api/ai/blog-titles  Body: { min?: number, max?: number }
//   1) min/max 검증 (없으면 기본 27~32)
//   2) keywords 테이블에서 region / phone_model 활성 리스트를 가져오고
//   3) Gemini 2.5 Flash 에 "지역 + 휴대폰 성지 + 기종 + 미사여구" 조합 제목을
//      min~max 개 사이 랜덤 개수로 만들어 달라고 요청한 뒤
//   4) 응답 텍스트를 한 줄=한 제목으로 파싱해 반환

import type { FastifyInstance } from 'fastify';
import type { RowDataPacket } from 'mysql2';

interface KeywordNameRow extends RowDataPacket {
  name: string;
}

interface PostKeywordRow extends RowDataPacket {
  keywords: string | null;
}

// 모델 이름은 .env 의 GEMINI_MODEL 로 덮어쓸 수 있음.
// ⚠️ gemini-1.5-flash, gemini-2.0-flash 는 deprecated → 404.
//    현재 권장: gemini-2.5-flash (최신·빠름), gemini-2.5-pro (고품질·느림)
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// 기본값 / 안전 한계
const DEFAULT_MIN = 27;
const DEFAULT_MAX = 32;
const HARD_MAX = 50; // 한 번에 너무 많이 요청하지 못하도록 상한

// ─── 이력 기반 pool 선정 파라미터 ─────────────────────────────
// 최근 N일간 발행된 posts.keywords 를 보고, 덜 쓰인 것부터 Gemini 에 전달할 pool 을 뽑는다.
const DEDUPE_WINDOW_DAYS = 20;
const FRESH_REGIONS = 40;   // 지역 pool: 최근 20일 안 쓴순 상위 40개
const FRESH_MODELS = 20;    // 기종 pool: 최근 20일 안 쓴순 상위 20개

// Fisher-Yates 셔플 — Gemini 가 앞쪽 것부터 우선 고르는 편향 방지
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// posts.keywords 안에서 지역 사용 횟수 세기.
// AI 프롬프트가 생성하는 형식이 "{region} 휴대폰 성지" 또는 "{region} 핸드폰 성지" 라서,
// "{region} " 로 시작하는 CSV 엔트리를 카운트.
function countRegionUsage(region: string, entries: string[]): number {
  const prefix = region + ' ';
  let n = 0;
  for (const e of entries) if (e.startsWith(prefix)) n++;
  return n;
}

// 기종 사용 횟수 — CSV 엔트리와 정확히 일치.
function countModelUsage(model: string, entries: string[]): number {
  let n = 0;
  for (const e of entries) if (e === model) n++;
  return n;
}

// 덜 쓴 순 (오름차순) 정렬 후 상위 limit 개 → 셔플.
function pickFreshKeywords(
  names: string[],
  entries: string[],
  countFn: (name: string, entries: string[]) => number,
  limit: number,
): string[] {
  const withCount = names.map((n) => ({ name: n, count: countFn(n, entries) }));
  withCount.sort((a, b) => a.count - b.count);
  const top = withCount.slice(0, limit).map((x) => x.name);
  return shuffle(top);
}

function buildPrompt(regions: string[], models: string[], min: number, max: number): string {
  const regionLines = regions.map((r) => `- ${r}`).join('\n');
  const modelLines = models.map((m) => `- ${m}`).join('\n');
  return `당신은 한국 휴대폰 블로그 제목을 만드는 전문 카피라이터입니다.

각 줄을 정확히 다음 형식으로 출력하세요:
[제목]|[지역+성지표현],[기종]

[제목] 형식: [지역] [성지표현] [기종] [미사여구]
[성지표현] 은 매 줄마다 "휴대폰 성지" 또는 "핸드폰 성지" 중 하나를 골라 쓰세요. 두 표현을 골고루 섞어 사용하세요.
주의: 한 줄 안에서 제목의 [성지표현] 과 키워드 부분의 [성지표현] 은 같게 하세요.
미사여구는 본 제목과 어울리게 자유롭게 작성 해주세요

ex)
강남 휴대폰 성지 갤럭시S26 최저가 확인|강남 휴대폰 성지,갤럭시S26
서초 핸드폰 성지 아이폰 17 프로 호갱 안 되는 법|서초 핸드폰 성지,아이폰 17 프로

--------

[지역] 후보 (이 목록 안에서만 선택):
${regionLines}

[기종] 후보 (이 목록 안에서만 선택):
${modelLines}

규칙:
1. 총 ${min}개 이상 ${max}개 이하로 무작위 개수만큼 작성하세요.
2. 모든 줄은 반드시 | 로 두 부분(제목, 키워드)을 구분하세요.
3. 키워드 부분은 정확히 두 개 — "지역+성지표현,기종" 순서로, 콤마 한 개로 구분하세요.
4. 미사여구는 절대 같은 표현을 반복하지 말고, 매 제목마다 다르게 만드세요.
5. 지역·기종도 한 조합이 너무 자주 반복되지 않게 골고루 섞으세요.
6. "휴대폰 성지" 와 "핸드폰 성지" 둘 다 골고루 등장해야 합니다.
7. 출력은 위 형식의 줄만, 한 줄에 하나씩.
8. 번호, 불릿(-, *), 따옴표, 마크다운, 설명, 인사말 등 어떤 부가 텍스트도 절대 포함하지 마세요.
9. 한국어로만 작성하세요.`;
}

// Body 의 min/max 검증 + 기본값/상한 적용
function resolveRange(body: { min?: unknown; max?: unknown }):
  | { ok: true; min: number; max: number }
  | { ok: false; message: string } {
  const rawMin = body.min;
  const rawMax = body.max;

  const min =
    rawMin === undefined || rawMin === null
      ? DEFAULT_MIN
      : typeof rawMin === 'number' && Number.isFinite(rawMin)
        ? Math.floor(rawMin)
        : NaN;
  const max =
    rawMax === undefined || rawMax === null
      ? DEFAULT_MAX
      : typeof rawMax === 'number' && Number.isFinite(rawMax)
        ? Math.floor(rawMax)
        : NaN;

  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return { ok: false, message: 'min / max 는 정수여야 합니다.' };
  }
  if (min < 1 || max < 1) {
    return { ok: false, message: 'min / max 는 1 이상이어야 합니다.' };
  }
  if (min > max) {
    return { ok: false, message: `최소값(${min})이 최대값(${max})보다 큽니다.` };
  }
  if (max > HARD_MAX) {
    return { ok: false, message: `한 번에 최대 ${HARD_MAX}개까지 생성할 수 있습니다.` };
  }
  return { ok: true, min, max };
}

function parseTitles(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        // 번호/불릿/따옴표/공백 정리
        .map((line) =>
          line
            .replace(/^\s*(?:\d+[.)]|[-*•·])\s*/, '')
            .replace(/^["'“”‘’`]+|["'“”‘’`]+$/g, '')
            .trim(),
        )
        .filter((line) => line.length > 0 && line.length <= 255),
    ),
  );
}

export default async function aiTitlesRoutes(app: FastifyInstance) {
  // GET /api/ai/ping?q=... — Gemini 단순 호출 테스트용. 브라우저에서 바로 확인 가능.
  app.get<{ Querystring: { q?: string } }>('/ping', async (req, reply) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return reply.internalServerError('GEMINI_API_KEY 가 설정되지 않았습니다.');

    const prompt = (req.query.q ?? '지금 동작해?').slice(0, 500);
    const url = `${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;

    const startedAt = Date.now();
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 256,
          thinkingConfig: { thinkingBudget: 0 }, // ping 은 thinking 불필요
        },
      }),
    });

    const elapsedMs = Date.now() - startedAt;
    const raw = await geminiRes.text();

    // 에러든 정상이든 다 그대로 보여준다 — 진단용
    let parsed: unknown = raw;
    try { parsed = JSON.parse(raw); } catch { /* keep as text */ }

    const reply_text =
      (parsed as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
        ?.candidates?.flatMap((c) => c.content?.parts ?? [])
        .map((p) => p.text ?? '')
        .join('\n')
        .trim() || null;

    return reply.code(geminiRes.ok ? 200 : geminiRes.status).send({
      ok: geminiRes.ok,
      status: geminiRes.status,
      model: GEMINI_MODEL,
      prompt,
      elapsed_ms: elapsedMs,
      reply: reply_text,        // ← 정상이면 여기에 답이 들어있음
      raw: parsed,              // ← 원본 (에러면 여기에 상세 사유)
    });
  });

  // GET /api/ai/models — 이 API 키로 호출 가능한 모델 목록 확인용 디버그 라우트
  app.get('/models', async (_req, reply) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return reply.internalServerError('GEMINI_API_KEY 가 설정되지 않았습니다.');

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    );
    const body = await res.text();
    if (!res.ok) {
      return reply.code(res.status).send({ status: res.status, body });
    }
    const json = JSON.parse(body) as {
      models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
    };
    // generateContent 지원하는 모델만 추리기
    const usable = (json.models ?? [])
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m) => m.name);
    return { usable, total: json.models?.length ?? 0 };
  });

  app.post<{ Body: { min?: number; max?: number } }>('/blog-titles', async (req, reply) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reply.internalServerError('GEMINI_API_KEY 가 설정되지 않았습니다.');
    }

    // 0) min / max 검증 (기본 27 ~ 32, 상한 50)
    const range = resolveRange(req.body ?? {});
    if (!range.ok) return reply.badRequest(range.message);
    const { min, max } = range;

    // 1) DB 에서 활성 키워드 목록 조회
    const [regionRows] = await app.db.query<KeywordNameRow[]>(
      `SELECT name FROM keywords
        WHERE category = 'region' AND is_active = 1
        ORDER BY sort_order ASC, id ASC`,
    );
    const [modelRows] = await app.db.query<KeywordNameRow[]>(
      `SELECT name FROM keywords
        WHERE category = 'phone_model' AND is_active = 1
        ORDER BY sort_order ASC, id ASC`,
    );

    const allRegions = regionRows.map((r) => r.name);
    const allModels = modelRows.map((r) => r.name);

    if (allRegions.length === 0) {
      return reply.badRequest('등록된 지역 키워드가 없습니다. 키워드 관리에서 먼저 추가해주세요.');
    }
    if (allModels.length === 0) {
      return reply.badRequest('등록된 기종 키워드가 없습니다. 키워드 관리에서 먼저 추가해주세요.');
    }

    // 1-b) 이력 기반 pool 선정 — 최근 N일 posts.keywords 를 읽어 덜 쓴 키워드 우선 뽑고 셔플.
    // Gemini 에 "쓰지 마세요" 목록을 넣는 대신, 애초에 신선한 pool 만 보여줘 프롬프트를 짧게 유지.
    const [postKwRows] = await app.db.query<PostKeywordRow[]>(
      `SELECT keywords FROM posts
        WHERE board_slug = 'blog' AND status = 'ACTIVE'
          AND keywords IS NOT NULL
          AND created_at >= NOW() - INTERVAL ? DAY`,
      [DEDUPE_WINDOW_DAYS],
    );
    // CSV 를 개별 엔트리 배열로 flat 화 — 카운트 함수가 이걸 스캔
    const usedEntries: string[] = [];
    for (const row of postKwRows) {
      if (!row.keywords) continue;
      for (const part of row.keywords.split(',')) {
        const t = part.trim();
        if (t) usedEntries.push(t);
      }
    }

    const regions = pickFreshKeywords(allRegions, usedEntries, countRegionUsage, FRESH_REGIONS);
    const models = pickFreshKeywords(allModels, usedEntries, countModelUsage, FRESH_MODELS);

    // 2) Gemini 호출
    const prompt = buildPrompt(regions, models, min, max);
    let geminiRes: Response;
    try {
      geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 1.0, // 다양한 미사여구 위해 높게
            topP: 0.95,
            maxOutputTokens: 2048, // 32개 제목 커버 (thinking off 라 여유 있음)
            // Gemini 2.5 의 thinking 비활성화 — 단순 제목 생성엔 불필요, 토큰 절약
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
    } catch (err) {
      app.log.error({ err }, 'Gemini API 호출 실패');
      return reply.internalServerError('AI 제목 생성에 실패했습니다.');
    }

    if (!geminiRes.ok) {
      const body = await geminiRes.text().catch(() => '');
      app.log.error({ status: geminiRes.status, model: GEMINI_MODEL, body }, 'Gemini 에러 응답');
      // 디버깅에 도움 되도록 본문도 함께 노출 (운영 전엔 마스킹 권장)
      return reply
        .code(502)
        .send({
          message: `AI 제목 생성에 실패했습니다. (status ${geminiRes.status}, model: ${GEMINI_MODEL})`,
          gemini: body,
        });
    }

    const data = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };

    const text = data.candidates
      ?.flatMap((c) => c.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('\n')
      .trim();

    if (!text) {
      return reply.internalServerError('AI 응답이 비어 있습니다. 잠시 후 다시 시도해주세요.');
    }

    // 3) 파싱 — 한 줄 = 한 제목, max 개로 자르기 (모자라면 받은 만큼)
    const all = parseTitles(text);
    const trimmed = all.slice(0, max);

    return {
      titles: trimmed,
      meta: {
        // Gemini 에 실제로 전달된 (fresh) pool 크기
        regions: regions.length,
        models: models.length,
        // 전체 활성 키워드 수 (참고)
        total_regions: allRegions.length,
        total_models: allModels.length,
        dedupe_window_days: DEDUPE_WINDOW_DAYS,
        requested_min: min,
        requested_max: max,
        got: trimmed.length,
      },
    };
  });
}
