import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { EXTRACT_MODEL, anthropic, type Usage } from '../anthropic.js';
import { badRequest } from '../http.js';

/**
 * 제조사 사양을 붙여넣으면 칸에 맞춰 정리한다.
 *
 * **AI 에게 사양을 묻지 않는다.** 주어진 자료에 있는 것만 옮긴다 —
 * 모델이 기억으로 채우면 그럴듯한 가짜 숫자가 들어가고, 그건 아무도 못 잡는다.
 * 그래서 없는 값은 비워 두게 하고, 어드민에서 사람이 확인한 뒤 저장한다.
 *
 * 화면용 문자열(display, battery …)과 비교용 숫자(displayInch, batteryMah …)를
 * 따로 받는 이유는 CLAUDE.md 에 적힌 대로다 — 문장에서 숫자를 긁어내면
 * 표기가 조금만 달라져도 깨진다.
 */

const SpecSchema = z.object({
  name: z
    .string()
    .describe('한국에서 부르는 기종 이름. 자료가 영어여도 한글로. 예: 갤럭시 S26 울트라, 아이폰 18 Pro'),
  brand: z.enum(['Samsung', 'Apple', '기타']),
  releaseDate: z.string().describe('출시 연월 YYYY-MM. 모르면 빈 문자열.'),
  retailPrice: z.number().describe('국내 출고가(원). 256GB 기준. 모르면 0.'),
  chipsetName: z.string().describe('칩셋 이름 그대로. 예: Snapdragon 8 Gen 5, A19 Pro. 모르면 빈 문자열.'),

  display: z.string().describe('화면 설명. 예: "6.9형 AMOLED · 120Hz"'),
  storage: z.string().describe('저장용량 선택지. 예: "256GB / 512GB / 1TB"'),
  battery: z.string().describe('배터리. 예: "5000mAh"'),
  charging: z.string().describe('충전. 예: "유선 45W · 무선 15W"'),
  cameraMain: z.string().describe('후면 카메라. 예: "2억 화소 (광각·망원·초광각)"'),
  cameraFront: z.string().describe('전면 카메라. 예: "1200만 화소"'),
  weight: z.string().describe('무게. 예: "218g"'),

  displayInch: z.number().describe('화면 인치. 예: 6.9. 모르면 0.'),
  refreshHz: z.number().describe('주사율 Hz. 예: 120. 모르면 0.'),
  memoryGb: z.number().describe('RAM 용량 GB. 예: 12. 모르면 0.'),
  batteryMah: z.number().describe('배터리 mAh. 예: 5000. 모르면 0.'),
  chargingWatt: z.number().describe('유선 충전 W. 예: 45. 모르면 0.'),
  cameraMainMp: z
    .number()
    .describe('후면 메인 카메라 화소를 **만 화소 단위**로. 5000만 화소 → 5000, 2억 화소 → 20000. 모르면 0.'),
  weightG: z.number().describe('무게 g. 예: 218. 모르면 0.'),

  missing: z.array(z.string()).describe('자료에 없어서 채우지 못한 항목 이름들. 사람이 채우라고 알려준다.'),
});

const PROMPT = `아래는 휴대폰 제조사가 공개한 사양 자료다. 이걸 정해진 칸에 옮겨라.

**지켜야 할 것 — 이게 전부다:**
- **자료에 있는 것만 옮겨라.** 네가 아는 지식으로 채우지 마라.
  기억으로 적은 숫자는 아무도 틀렸는지 못 알아채고 그대로 공개된다.
- 자료에 없는 값은 숫자는 0, 문자열은 빈 문자열로 두고 missing 에 항목 이름을 적어라.
- 단위를 바꾸지 마라. mAh 는 mAh 로, W 는 W 로.
- **카메라 화소만 만 화소 단위로 바꾼다.** 50MP = 5000만 화소 = 5000, 200MP = 2억 화소 = 20000.
- 가격은 국내 출고가(원)다. 달러만 있으면 환산하지 말고 0 으로 두고 missing 에 적어라.
- **화면용 문자열은 전부 한국 표기로 적어라.** 자료가 영어여도 마찬가지다.
  - 기종 이름: iPhone 18 Pro → "아이폰 18 Pro", Galaxy S26 Ultra → "갤럭시 S26 울트라"
  - 화면: "6.9 inch AMOLED 120Hz" → "6.9형 AMOLED · 120Hz"
  - 카메라: "48MP Ultra Wide" → "4800만 화소 초광각", "12MP 5x Telephoto" → "1200만 화소 망원(5배)"
    (Wide=광각, Ultra Wide=초광각, Telephoto=망원)
  - 단위는 숫자에 붙여 쓴다: "3800 mAh" → "3800mAh", "199 grams" → "199g"
  - "(typical)", "(rounded corners)" 처럼 사양이 아닌 영어 주석은 떼라.
    조리개(F1.7)·OIS 같은 규격 표기는 남겨도 된다.
  제품명 안의 영문 모델명(S26, 18 Pro, Pro Max)은 그대로 둔다 — 번역하지 마라.
- 용량이 여러 개면 가장 작은 것 기준으로 가격을 적고, storage 에는 전부 나열해라.

**단위 환산은 해도 된다 — 추측이 아니라 계산이다:**
- 삼성은 화면 크기를 mm 로 적는다(예: 174.2mm). 25.4 로 나눠 인치로 바꿔라(174.2 → 6.9).
  display 문자열에도 인치로 적어라.
- "25년 1월" 같은 표기는 2025-01 로 바꿔라.
- MP 를 만 화소로 바꾸는 것도 마찬가지다.

그 외에는 자료에 적힌 값을 그대로 둬라. **아는 지식으로 메우는 것과 환산은 다르다.**
"Octa-Core 4.47GHz" 만 적혀 있으면 칩셋 이름은 모르는 것이다 — 비워라.`;

/**
 * 못 채운 항목을 화면에 띄울 이름으로 바꾼다.
 *
 * 모델은 `missing` 에 스키마의 칸 이름(`retailPrice`)을 적어 준다. 그대로 띄우면
 * 어드민에서 "못 채운 항목 — retailPrice" 가 되고, 어느 칸인지 알 수 없다.
 */
const FIELD_LABELS: Record<string, string> = {
  name: '기종 이름',
  brand: '제조사',
  releaseDate: '출시',
  retailPrice: '출고가',
  chipsetName: '칩셋',
  display: '화면',
  storage: '저장용량',
  battery: '배터리',
  charging: '충전',
  cameraMain: '후면 카메라',
  cameraFront: '전면 카메라',
  weight: '무게',
  displayInch: '화면 인치',
  refreshHz: '주사율',
  memoryGb: 'RAM',
  batteryMah: '배터리 용량',
  chargingWatt: '충전 속도',
  cameraMainMp: '후면 화소',
  weightG: '무게(g)',
};

/** 모르는 이름은 모델이 적은 그대로 둔다 — 지우면 사람이 뭘 놓쳤는지 모른다 */
const label = (field: string) => FIELD_LABELS[field.trim()] ?? field.trim();

export interface ExtractedSpec extends z.infer<typeof SpecSchema> {
  usage: Usage;
  model: string;
}

/** 붙여넣은 글 또는 사양 화면 캡처에서 사양을 뽑는다 */
export async function extractSpec(
  input: { text?: string; image?: { data: Buffer; mimetype: string } },
  modelOverride?: string,
): Promise<ExtractedSpec> {
  const client = anthropic();
  if (!client) throw badRequest('ANTHROPIC_API_KEY 가 없어 사양을 읽을 수 없습니다.');
  if (!input.text?.trim() && !input.image) throw badRequest('사양 자료를 넣어주세요.');

  // 빈 배열에 밀어 넣으면 첫 원소로 타입이 좁혀져 image 블록이 안 들어간다. 한 번에 만든다.
  const content = [
    ...(input.image
      ? [
          {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: input.image.mimetype as 'image/jpeg',
              data: input.image.data.toString('base64'),
            },
          },
        ]
      : []),
    {
      type: 'text' as const,
      text: `${PROMPT}\n\n## 사양 자료\n${input.text?.slice(0, 20000) ?? '(위 이미지 참고)'}`,
    },
  ];

  const model = modelOverride ?? EXTRACT_MODEL;
  const response = await client.messages.parse({
    model,
    max_tokens: 4000,
    output_config: { format: zodOutputFormat(SpecSchema) },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') throw badRequest('이 자료는 읽을 수 없습니다.');
  const parsed = response.parsed_output;
  if (!parsed) throw badRequest('사양을 읽지 못했습니다. 자료를 확인해주세요.');

  // 같은 항목을 칸 이름과 한글로 두 번 적어 오는 경우가 있어 중복을 지운다
  const missing = [...new Set(parsed.missing.map(label))];

  return { ...parsed, missing, usage: response.usage, model };
}
