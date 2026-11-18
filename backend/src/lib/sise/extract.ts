import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { EXTRACT_MODEL, anthropic } from '../anthropic.js';
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
    .describe('표의 모든 칸. 기종 하나당 (통신사 3개) x (번이/기변) = 6줄.'),
});

const PROMPT = `첨부한 이미지는 한국 휴대폰 판매점의 시세표다. 표의 모든 칸을 빠짐없이 읽어라.

표 읽는 법:
- 가로로 통신사(SK / KT / LG)가 나뉘고, 통신사마다 요금제 이름이 붙는다.
- 그 아래가 다시 "번이"(번호이동)와 "기변"(기기변경)으로 갈린다.
- 세로는 기종이고, 용량 열이 따로 있다.
- 기종 하나당 (통신사 3개) x (번이/기변 2개) = 6칸이 나온다. 6줄로 만들어라.

숫자 규칙 — 여기가 제일 중요하다:
- 단위는 만원이다. 17 이면 할부원금 17만원이다.
- **음수는 페이백이다.** -23 은 "23만원을 돌려준다"는 뜻이다. 빨간 글씨로 적히는 경우가 많다.
- 빼기 기호를 절대 빠뜨리지 마라. 부호 하나가 54만원 차이를 만든다.
- 칸이 비었거나 "문의" 같은 글자면 그 줄은 넣지 마라.

지어내지 마라. 흐려서 못 읽는 칸은 빼라. 있는 것만 정확히 넘기는 쪽이 낫다.`;

/** 이미지(버퍼) → 시세표 초안. 사람이 확인한 뒤에 저장한다. */
export async function extractSheet(image: Buffer, mimetype: string): Promise<SiseSheetDraft> {
  const client = anthropic();
  if (!client) throw badRequest('ANTHROPIC_API_KEY 가 없어 시세표를 읽을 수 없습니다.');

  const response = await client.messages.parse({
    model: EXTRACT_MODEL,
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
  if (rows.length === 0) throw badRequest('표에서 읽어낸 행이 없습니다. 시세표 이미지가 맞는지 확인해주세요.');

  return { note: parsed.note.slice(0, 300), rows };
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
