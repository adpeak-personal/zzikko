import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { EXTRACT_MODEL, anthropic, type Usage } from '../anthropic.js';
import { badRequest } from '../http.js';
import type { SiseRow, SiseSheetDraft } from '../../types.js';

/**
 * 시세표 이미지에서 행을 뽑아낸다.
 *
 * 형식을 강제하는 수단으로 structured outputs 를 쓴다 — 자유 문장으로 받으면
 * 모양이 매번 흔들리고, 숫자가 문장에 섞여 나오면 파싱하다 틀린다.
 * (강제 tool_choice 는 최신 모델에서 400 이라 쓸 수 없다.)
 */

/** 표에 적히는 줄임말 → DB 에 쓰는 값 */
const CARRIER_ALIAS: Record<string, SiseRow['carrier']> = {
  SK: 'SKT',
  SKT: 'SKT',
  'SK telecom': 'SKT',
  'SK텔레콤': 'SKT',
  KT: 'KT',
  LG: 'LG U+',
  'LG U+': 'LG U+',
  'U+': 'LG U+',
  LGU: 'LG U+',
  'LG유플러스': 'LG U+',
  알뜰폰: '알뜰폰',
};

const JOIN_ALIAS: Record<string, SiseRow['joinType']> = {
  번이: '번호이동',
  번호이동: '번호이동',
  MNP: '번호이동',
  기변: '기기변경',
  기기변경: '기기변경',
  신규: '신규가입',
  신규가입: '신규가입',
};

/** 모델이 돌려줄 모양. 값은 표에 적힌 그대로 받고, 우리 형식으로는 아래에서 바꾼다. */
const SheetSchema = z.object({
  note: z
    .string()
    .describe('표 머리에 적힌 조건문을 그대로. 예: "KT, LG → SK 유심만 이동시 25% 요금할인". 없으면 빈 문자열.'),
  rows: z
    .array(
      z.object({
        series: z.string().describe('묶음 제목. 예: 아이폰18 시리즈, 갤럭시 시리즈, 폴더블 시리즈'),
        model: z.string().describe('기종. 예: 아이폰18 Pro, S26 울트라, Z플립8'),
        storage: z.string().describe('용량. 예: 256'),
        carrier: z.string().describe('SK / KT / LG 중 하나 (표의 열 머리)'),
        plan: z.string().describe('요금제 이름. 예: 베스트 109, 초이스 스페셜, 플러스 플랜'),
        joinType: z.string().describe('번이 또는 기변'),
        price: z
          .number()
          .describe('칸에 적힌 숫자를 그대로. 단위는 만원이고 음수는 페이백이다. 17 → 17, -23 → -23'),
      }),
    )
    .describe('표의 모든 칸. 한 칸이 한 줄이다. 요금제 열이 여러 개면 요금제마다 번이·기변을 따로 넘긴다.'),
});

const PROMPT = `첨부한 이미지는 한국 휴대폰 판매점의 시세표다. 표의 모든 칸을 빠짐없이 읽어라.

표 읽는 법:
- 보통 가로로 통신사(SK / KT / LG)가 나뉘고, 통신사마다 요금제 이름이 붙는다.
- 그 아래가 다시 "번이"(번호이동)와 "기변"(기기변경)으로 갈린다.
- 세로는 기종이다. 용량이 열로 따로 있기도 하고 기종 이름에 붙어 있기도 하다(S26 512G).
- 칸 하나가 한 줄이다. **몇 줄이 나와야 한다고 미리 정하지 마라.**

양식은 매장마다 다르다. 아래 경우를 모두 그대로 옮겨라:
- **통신사 하나에 요금제 열이 여러 개**인 표(예: "제휴 프로모션"과 "현금 구매가"). 이때는
  요금제마다 번이·기변이 따로 있으므로 기종 하나에 12칸이 나온다. plan 에 각 요금제 이름을
  넣어 전부 넘겨라. 한쪽만 읽고 버리지 마라.
- **한 이미지에 표가 여러 개**인 경우(좌우로 나뉘거나 위아래로 이어짐). 전부 읽어라.
  표끼리 기종이 겹쳐도 상관없다 — 요금제나 조건이 다르면 plan 에 구분되는 이름을 적어라.
  구분할 단서가 전혀 없으면 그때만 하나를 고르고 note 에 그 사실을 적어라.
- **통신사가 가로로 나뉘어 표가 3덩이**인 경우. 덩이마다 같은 기종 줄을 찾아 합쳐라.
- 출고가·비고처럼 가입 조건이 아닌 열은 넘기지 마라.

숫자 규칙 — 여기가 제일 중요하다:
- 단위는 만원이다. 17 이면 할부원금 17만원이다.
- **음수는 페이백이다.** -23 은 "23만원을 돌려준다"는 뜻이다. 빨간 글씨로 적히는 경우가 많다.
- 빼기 기호를 절대 빠뜨리지 마라. 부호 하나가 54만원 차이를 만든다.
- 칸이 비었거나 검게 칠해졌거나 "소진"·"문의" 같은 글자면 그 줄은 넣지 마라.

표에 통신사 머리글이 없으면(잘린 이미지 등) 통신사를 추측하지 마라. 그럴 땐 빈 목록을 주고
note 에 "통신사 머리글이 없어 읽을 수 없다"고 적어라.

지어내지 마라. 흐려서 못 읽는 칸은 빼라. 있는 것만 정확히 넘기는 쪽이 낫다.`;

/** 이미지(버퍼) → 시세표 초안. 사람이 확인한 뒤에 저장한다. */
export async function extractSheet(
  image: Buffer,
  mimetype: string,
  /** 모델을 바꿔 정확도를 견줄 때만 넘긴다. 평소엔 ANTHROPIC_MODEL 을 쓴다. */
  modelOverride?: string,
): Promise<SiseSheetDraft & { usage: Usage; model: string }> {
  const client = anthropic();
  if (!client) throw badRequest('ANTHROPIC_API_KEY 가 없어 시세표를 읽을 수 없습니다.');

  const model = modelOverride ?? EXTRACT_MODEL;
  const response = await client.messages.parse({
    model,
    // 칸이 200개를 넘는 표도 있어 넉넉히 둔다 — 중간에 잘리면 행이 통째로 사라진다
    max_tokens: 16000,
    output_config: { format: zodOutputFormat(SheetSchema) },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimetype as 'image/jpeg', data: image.toString('base64') },
          },
          { type: 'text', text: PROMPT },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw badRequest('이 이미지는 읽을 수 없습니다.');
  if (response.stop_reason === 'max_tokens') throw badRequest('표가 너무 커서 다 읽지 못했습니다. 나눠서 올려주세요.');

  const parsed = response.parsed_output;
  if (!parsed) throw badRequest('시세표를 읽지 못했습니다. 다른 이미지로 시도해보세요.');

  const rows = parsed.rows.map(normalizeRow).filter((row): row is SiseRow => row !== null);
  if (rows.length === 0) {
    // 왜 못 읽었는지는 모델이 note 에 적어 준다 — 그걸 그대로 보여줘야 사람이 고칠 수 있다
    // (통신사 머리글이 잘린 이미지가 가장 흔하다)
    const reason = parsed.note.trim();
    throw badRequest(
      reason
        ? `시세표를 읽지 못했습니다 — ${reason.slice(0, 200)}`
        : '표에서 읽어낸 행이 없습니다. 통신사 머리글(SK·KT·LG)이 함께 보이는 이미지인지 확인해주세요.',
    );
  }

  return { note: parsed.note.slice(0, 300), rows, usage: response.usage, model };
}

/** 모델이 준 줄 하나를 우리 형식으로. 말이 안 되면 null 로 버린다. */
function normalizeRow(row: z.infer<typeof SheetSchema>['rows'][number]): SiseRow | null {
  const carrier = CARRIER_ALIAS[row.carrier.trim()];
  const joinType = JOIN_ALIAS[row.joinType.trim()];
  const model = row.model.trim();

  if (!carrier || !joinType || !model || !Number.isFinite(row.price)) return null;

  return {
    series: row.series.trim().slice(0, 40),
    model: model.slice(0, 60),
    storage: row.storage.trim().slice(0, 20),
    carrier,
    plan: row.plan.trim().slice(0, 40),
    joinType,
    price: Math.round(row.price),
  };
}
