// AI 제목 생성 — n_blog_writer/title_generator.py 를 그대로 이식.
//
// POST /api/ai/nblog-titles
//   Body: { items: Array<{ category, keyword? }> }  (최대 50건)
//   Returns: { items: Array<{ ok, title, keyword, error? }>, succeeded, failed, total }
//
// 카테고리별 처리 (파이썬과 1:1):
//   cate1/cate2 → Perplexity(sonar-pro) 로 웹검색 기반 제목 →
//                 OpenAI(gpt-4o-mini) 로 이미지 검색용 키워드 추출
//   cate3/cate4 → OpenAI(gpt-4o-mini) 로 사용자 키워드 기반 제목만 다듬음 (키워드는 그대로 반환)
//
// 필요한 환경변수:  .env 의 PPLX_KEY, GPT_KEY  (파이썬 프로젝트와 동일 값 사용 가능)

import type { FastifyInstance } from 'fastify';

const TITLE_MODEL = 'sonar-pro';        // Perplexity — 웹검색 기반 제목
const KEYWORD_MODEL = 'gpt-4o-mini';    // OpenAI — 키워드 추출 / 키워드 기반 제목
const PPLX_URL = 'https://api.perplexity.ai/chat/completions';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

const MAX_ITEMS = 50;                   // 한 요청 최대 건수
const CONCURRENCY = 4;                  // 내부 병렬도 (rate limit 고려)

// ─── 프롬프트 (파이썬 title_generator.py 원문 그대로) ───────

const SYSTEM_PROMPT =
  '당신은 네이버 블로그 제목을 뽑는 카피라이터입니다. ' +
  '웹 검색 결과를 바탕으로, 클릭을 유도하면서도 과장이 심하지 않은 ' +
  '구체적인 제목을 만듭니다.';

const FORMAT_HINT =
  '\n\n제목만 한 줄로 출력하세요. 따옴표, 번호, 각주([1] 등), ' +
  '마크다운 기호는 붙이지 마세요.';

const CATEGORY_PROMPTS: Record<'cate1' | 'cate2', string> = {
  cate1:
    '국내 연예인 한 명을 임의로 골라, 그 인물의 근황·이슈·작품 활동 중 ' +
    '하나를 다루는 네이버 블로그 제목을 만들어주세요. ' +
    '가능하면 최근 2주 이내의 이슈·활동·발언·작품 소식을 우선으로 하되, ' +
    '마땅한 최신 이슈가 없다면 그 인물의 최근 근황이나 진행 중인 작품 활동으로 ' +
    '대체해도 좋습니다. ' +
    '배우·가수·아이돌·예능인 등 다양한 인물 풀에서 뽑아주세요. ' +
    '실존 인물과 실제 활동 내용을 담되, ' +
    '기사 헤드라인을 그대로 가져오지 말고 개인 블로그 제목 톤으로 다시 써주세요.\n' +
    '예: 애프터스쿨 비쥬얼 센터 유이 최근 근황\n' +
    '예: 배우 손예진 새 드라마 촬영장 목격담 정리\n' +
    '예: 아이유 신곡 티저 공개 반응 모아봤어요\n' +
    '예: 예능 대세 이용진 요즘 스케줄 총정리',
  cate2:
    '음식 하나를 임의로 골라 소개하는 네이버 블로그 제목을 만들어주세요. ' +
    '요리(완성된 음식) 일 수도 있고 식재료 하나일 수도 있습니다. ' +
    '한식·양식·중식·일식·분식·디저트·간식 같은 다양한 요리 카테고리와, ' +
    '채소·과일·해산물·육류·유제품 같은 다양한 재료군 중에서 골고루 뽑아주세요. ' +
    '특정 음식만 반복해서 고르지 말고 매번 다른 종류를 선택해주세요. ' +
    '레시피·효능·제철·손질법·보관법·활용법 같은 관점 중 하나를 다루면 됩니다.\n' +
    '예: 제철 대하 손질법과 보관 요령 정리\n' +
    '예: 집에서 만드는 부드러운 크림 파스타 레시피\n' +
    '예: 여름철 오이 활용법과 효능 총정리\n' +
    '예: 겉바속촉 간장 찜닭 만드는 법',
};

const KEYWORD_TITLE_PROMPTS: Record<'cate3' | 'cate4', (kw: string) => string> = {
  cate3: (kw) =>
    `다음 부동산 단지 정보를 다루는 네이버 블로그 제목을 만들어주세요.\n` +
    `단지/키워드: ${kw}\n\n` +
    `입지·세대 구성·교통·학군·투자 포인트 관점에서 관심을 끌 만한, ` +
    `구체적이면서 과장 없는 담백한 제목을 뽑아주세요.\n` +
    `예: 숭의역 라온프라이빗 다양한 분양 정보`,
  cate4: (kw) =>
    `다음 모바일/웨어러블 제품을 다루는 네이버 블로그 제목을 만들어주세요.\n` +
    `제품/키워드: ${kw}\n\n` +
    `주요 스펙, 색상, 디자인, 기능, 카메라, 가격 등 정보 위주의 ` +
    `구체적이고 담백한 제목을 뽑아주세요. 사전예약 관련 내용은 언급하지 마세요.\n` +
    `예: 갤럭시워치7 새 기능과 색상 옵션 정리`,
};

const KEYWORD_EXTRACT_PROMPTS: Record<'cate1' | 'cate2', (t: string) => string> = {
  cate1: (t) =>
    `다음 네이버 블로그 제목에서 이미지 검색에 사용할 핵심 키워드를 뽑아주세요.\n` +
    `인물 이름 하나만으로 충분합니다. 다른 부가어(작품명, 소속사 등) 는 붙이지 마세요.\n\n` +
    `제목: ${t}\n\n키워드만 한 줄로 출력하세요. 따옴표나 설명은 붙이지 마세요.`,
  cate2: (t) =>
    `다음 네이버 블로그 제목에서 이미지 검색에 사용할 핵심 키워드를 뽑아주세요.\n` +
    `음식/재료 이름 중심으로 1~2어절 정도가 좋습니다. ` +
    `부가어(레시피, 만드는 법, 효능 등) 는 빼주세요.\n` +
    `예: '겉바속촉 간장 찜닭 만드는 법' → 간장 찜닭\n` +
    `예: '여름철 오이 활용법과 효능 총정리' → 오이\n\n` +
    `제목: ${t}\n\n키워드만 한 줄로 출력하세요. 따옴표나 설명은 붙이지 마세요.`,
};

// 파이썬의 _cleanup — [1], "" 정리
function cleanup(text: string): string {
  return text
    .replace(/\[\d+\]/g, '')
    .trim()
    .replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '')
    .trim();
}

// ─── AI 호출 헬퍼 ──────────────────────────────────────────

async function callChat(
  url: string,
  apiKey: string,
  body: unknown,
): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${res.status} ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return cleanup(json.choices?.[0]?.message?.content ?? '');
}

async function generateTitlePplx(apiKey: string, category: 'cate1' | 'cate2') {
  return callChat(PPLX_URL, apiKey, {
    model: TITLE_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: CATEGORY_PROMPTS[category] + FORMAT_HINT },
    ],
    temperature: 0.9,
  });
}

async function generateTitleFromKeywordGpt(
  apiKey: string,
  category: 'cate3' | 'cate4',
  keyword: string,
) {
  return callChat(OPENAI_URL, apiKey, {
    model: KEYWORD_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: KEYWORD_TITLE_PROMPTS[category](keyword) + FORMAT_HINT,
      },
    ],
    temperature: 0.8,
  });
}

async function extractKeywordGpt(
  apiKey: string,
  category: 'cate1' | 'cate2',
  title: string,
) {
  return callChat(OPENAI_URL, apiKey, {
    model: KEYWORD_MODEL,
    messages: [
      { role: 'system', content: '핵심 키워드만 정확히 뽑아주는 도우미입니다.' },
      { role: 'user', content: KEYWORD_EXTRACT_PROMPTS[category](title) },
    ],
    temperature: 0.3,
  });
}

// 카테고리 한 건 처리 — 파이썬 workspace.prepare_subjects 의 채우기 흐름 그대로
async function generateOne(
  category: string,
  keyword: string | undefined,
): Promise<{ title: string; keyword: string }> {
  const pplxKey = process.env.PPLX_KEY;
  const gptKey = process.env.GPT_KEY;

  if (category === 'cate1' || category === 'cate2') {
    if (!pplxKey) throw new Error('.env 의 PPLX_KEY 가 없습니다.');
    if (!gptKey) throw new Error('.env 의 GPT_KEY 가 없습니다.');
    const title = await generateTitlePplx(pplxKey, category);
    if (!title) throw new Error('제목 생성 응답이 비어있습니다.');
    const kw = await extractKeywordGpt(gptKey, category, title);
    return { title, keyword: kw };
  }

  if (category === 'cate3' || category === 'cate4') {
    if (!gptKey) throw new Error('.env 의 GPT_KEY 가 없습니다.');
    if (!keyword) throw new Error('cate3/cate4 는 keyword 가 필요합니다.');
    const title = await generateTitleFromKeywordGpt(gptKey, category, keyword);
    if (!title) throw new Error('제목 생성 응답이 비어있습니다.');
    return { title, keyword };
  }

  throw new Error(`알 수 없는 category: ${category}`);
}

// 동시성 제한 병렬 실행
async function batchProcess<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

// ─── 라우트 ─────────────────────────────────────────────────

export default async function nblogTitlesRoutes(app: FastifyInstance) {
  app.post<{
    Body: { items: Array<{ category: string; keyword?: string }> };
  }>(
    '/nblog-titles',
    {
      schema: {
        body: {
          type: 'object',
          required: ['items'],
          properties: {
            items: {
              type: 'array',
              minItems: 1,
              maxItems: MAX_ITEMS,
              items: {
                type: 'object',
                required: ['category'],
                properties: {
                  category: { type: 'string', enum: ['cate1', 'cate2', 'cate3', 'cate4'] },
                  keyword: { type: 'string', maxLength: 200 },
                },
              },
            },
          },
        },
      },
    },
    async (req) => {
      const items = req.body.items;
      const results = await batchProcess(items, CONCURRENCY, async (it) => {
        try {
          const out = await generateOne(it.category, it.keyword);
          return { ok: true as const, title: out.title, keyword: out.keyword };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          app.log.warn({ category: it.category, keyword: it.keyword, err: msg }, 'nblog-title 실패');
          return {
            ok: false as const,
            title: '',
            keyword: it.keyword ?? '',
            error: msg,
          };
        }
      });
      return {
        items: results,
        total: results.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      };
    },
  );
}
