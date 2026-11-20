/**
 * 수집한 소식의 **제목만** 한국어로 옮긴다.
 *
 * 목록에서 어떤 소식인지 바로 알아보려고 두는 것이지, 기사 본문과는 상관없다.
 * 기사는 `lib/news/write.ts` 가 사실만 골라 **새로 쓴다** — 번역이 아니다.
 *
 * 원문 제목(`news_feed.title`)은 그대로 둔다. 번역이 이상할 때 대조할 수 있어야 하고,
 * 출처를 밝히는 자리에서도 원문이 정본이다.
 *
 * 한 번에 묶어서 부른다 — 제목 20개라도 한 호출이면 1원이 안 든다.
 */
import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { TRANSLATE_MODEL, anthropic, type Usage } from '../anthropic.js';

/**
 * 한 번에 묶을 제목 수.
 *
 * ⚠️ 한국어는 토큰을 많이 먹는다. 20개씩 묶었더니 `max_tokens` 에 걸려 응답이 잘렸고,
 * 그러면 `parsed_output` 이 비어서 **전부 원문으로 되돌아갔다.** 넉넉히 잡을 것.
 */
const CHUNK = 10;
const MAX_TOKENS = 4000;

const Schema = z.object({
  titles: z
    .array(z.string())
    .describe('옮긴 제목. 받은 것과 **같은 개수, 같은 순서**로 돌려준다.'),
});

const PROMPT = `아래는 해외 IT 매체의 기사 제목이다. 한국 독자가 한눈에 알아보게 한국어로 옮겨라.

지킬 것
- **같은 개수, 같은 순서**로 돌려준다. 하나라도 빠지면 엉뚱한 제목이 붙는다.
- 기기 이름은 한국에서 쓰는 표기로. iPhone → 아이폰, Galaxy → 갤럭시, Pixel → 픽셀.
  다만 제품명 속 영문·숫자 모델명(S26, 18 Pro, Pro Max, Ultra)은 그대로 둔다.
- 회사 이름은 익숙한 쪽으로. Samsung → 삼성, Apple → 애플, Qualcomm → 퀄컴.
- 제목이니 짧게. 원문에 없는 말을 넣지 마라. 과장(최초·충격·역대급)을 더하지 마라.
- 루머·유출 기사면 그 어감을 살려라 ("…유출", "…설", "…전망").
- 이미 한국어인 제목은 **그대로** 돌려준다.
- **한자를 쓰지 마라.** 採用 → 채용 처럼 한글로 적는다.
- 옮기기 애매하면 원문을 그대로 둬라. 지어내는 것보다 낫다.`;

export interface Translated {
  titles: string[];
  /** 묶음을 여러 번 불렀을 수 있어 합계로 준다 */
  usage: Usage;
  model: string;
}

/**
 * 제목 목록을 한국어로. 실패하면 **원문을 그대로 돌려준다** —
 * 번역은 거들 뿐이라, 안 된다고 수집까지 막을 이유가 없다.
 */
export async function translateTitles(
  titles: string[],
  log?: (message: string) => void,
): Promise<Translated> {
  const usage: Usage = { input_tokens: 0, output_tokens: 0 };
  const client = anthropic();
  if (!client || titles.length === 0) return { titles, usage, model: TRANSLATE_MODEL };

  const out: string[] = [];
  for (let index = 0; index < titles.length; index += CHUNK) {
    const chunk = titles.slice(index, index + CHUNK);
    try {
      const response = await client.messages.parse({
        model: TRANSLATE_MODEL,
        max_tokens: MAX_TOKENS,
        output_config: { format: zodOutputFormat(Schema) },
        messages: [
          { role: 'user', content: `${PROMPT}\n\n${chunk.map((title, n) => `${n + 1}. ${title}`).join('\n')}` },
        ],
      });

      usage.input_tokens += response.usage.input_tokens;
      usage.output_tokens += response.usage.output_tokens;

      const parsed = response.parsed_output?.titles ?? [];
      // 개수가 어긋나면 짝이 밀린다 — 그 묶음은 통째로 원문을 쓴다.
      // 조용히 넘기면 "번역이 안 되네" 하고 원인을 못 찾으므로 남긴다.
      if (parsed.length !== chunk.length) {
        log?.(`제목 번역 건너뜀 — ${chunk.length}개 보내고 ${parsed.length}개 받음 (${response.stop_reason})`);
        out.push(...chunk);
        continue;
      }
      out.push(...parsed.map((title, n) => title.trim().slice(0, 300) || chunk[n]!));
    } catch (err) {
      log?.(`제목 번역 실패 — ${err instanceof Error ? err.message : String(err)}`);
      out.push(...chunk);
    }
  }

  return { titles: out, usage, model: TRANSLATE_MODEL };
}
