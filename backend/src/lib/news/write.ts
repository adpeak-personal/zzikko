import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { WRITE_MODEL, anthropic, type Usage } from '../anthropic.js';
import { badRequest } from '../http.js';

/**
 * 영어 기사를 한국어 기사로 다시 쓴다.
 *
 * **번역이 아니라 재작성이다.** 두 가지 이유가 있다.
 *  - 저작권: 번역도 복제로 본다. 사실을 뽑아 새로 쓰는 건 다르다.
 *  - SEO: 구글은 번역본을 중복 콘텐츠로 보고 원문 뒤로 민다.
 *
 * 출처 표기는 선택이 아니다 — GSMArena 가 license.xml 에서
 * ai-summarize 를 허용하는 조건으로 CC BY 4.0 방식 표기를 요구한다.
 * 그래서 기사에는 늘 source_name 과 source_url 을 함께 저장한다.
 */

const ArticleSchema = z.object({
  title: z
    .string()
    .describe('한국어 제목. 40자 안쪽. 기종 이름과 핵심 사실을 앞에 둔다. 낚시성 표현은 쓰지 않는다.'),
  summary: z.string().describe('두 문장 요약. 검색 결과에 뜬다. 140자 안쪽.'),
  body: z
    .string()
    .describe(
      '한국어 기사 본문. 3~5문단, 문단 사이는 빈 줄로 나눈다. 원문 문장을 옮기지 말고 사실만 골라 새로 쓴다.',
    ),
  category: z
    .enum(['신제품', '업데이트', '출시·가격', '시장·업계', '기타'])
    .describe('기사 성격에 맞는 분류 하나'),
  relevance: z
    .number()
    .describe('한국 휴대폰 구매자에게 얼마나 쓸모 있는지 0~100. 국내 출시 기종·가격 소식일수록 높다.'),
});

const PROMPT = `너는 한국 휴대폰 커뮤니티 "찍고"의 편집자다. 아래 영어 기사를 보고 **한국어 기사를 새로 쓴다.**

지켜야 할 것:
- **번역하지 마라.** 사실만 골라내 한국 독자에게 맞는 글로 다시 써라.
  원문 문장 구조를 그대로 따라가면 안 된다.
- **원문에 없는 사실을 지어내지 마라.** 모르면 쓰지 마라.
- 숫자(용량·가격·배터리·날짜)는 원문 그대로 옮겨라. 환율은 계산하지 말고 원문 통화를 적어라.
- 기종 이름은 한국에서 부르는 대로 쓴다. Galaxy S26 → 갤럭시 S26, iPhone 17 Pro → 아이폰 17 Pro.
- 확정이 아닌 건 "유출", "~로 추정" 처럼 분명히 구분해라. 소문을 사실처럼 쓰지 마라.
- 존댓말로, 담백하게. "역대급", "충격" 같은 과장은 쓰지 마라.
- 한국 출시나 국내 가격과 관계있으면 그 점을 짚어라. 찍고 독자가 궁금한 건 그쪽이다.
- **"원문에 따르면", "기사에서는" 같은 말을 쓰지 마라.** 네가 쓴 기사지 남의 기사 소개가 아니다.
  출처는 화면 아래에 따로 붙으니 본문에서 언급할 필요가 없다.
- 확인되지 않은 내용을 굳이 "확인되지 않았다"고 덧붙이지 마라. 아는 것만 쓰고 끝내라.

relevance 는 솔직하게 매겨라. 인도·유럽에만 나오는 보급형 소식이면 낮고,
삼성·애플 주력 기종이나 국내 출시·가격 이야기면 높다.`;

export interface WrittenArticle {
  title: string;
  summary: string;
  body: string;
  category: string;
  relevance: number;
  usage: Usage;
  model: string;
}

export async function writeArticle(
  input: { title: string; sourceText: string; sourceName: string },
  modelOverride?: string,
): Promise<WrittenArticle> {
  const client = anthropic();
  if (!client) throw badRequest('ANTHROPIC_API_KEY 가 없어 기사를 쓸 수 없습니다.');

  const model = modelOverride ?? WRITE_MODEL;
  const response = await client.messages.parse({
    model,
    max_tokens: 4000,
    output_config: { format: zodOutputFormat(ArticleSchema) },
    messages: [
      {
        role: 'user',
        content: `${PROMPT}\n\n## 원문 (${input.sourceName})\n제목: ${input.title}\n\n${input.sourceText.slice(0, 8000)}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw badRequest('이 기사는 다룰 수 없습니다.');

  const parsed = response.parsed_output;
  if (!parsed) throw badRequest('기사를 쓰지 못했습니다. 다시 시도해주세요.');

  return {
    title: parsed.title.trim().slice(0, 120),
    summary: parsed.summary.trim().slice(0, 200),
    body: parsed.body.trim(),
    category: parsed.category,
    relevance: Math.max(0, Math.min(100, Math.round(parsed.relevance))),
    usage: response.usage,
    model,
  };
}
