import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { WRITE_MODEL, anthropic } from '../anthropic.js';
import { badRequest } from '../http.js';
import { lowestByModel, type SiseComparison } from './compare.js';
import type { Region, SiseRow, SiseSections } from '../../types.js';

/**
 * 시세표를 놓고 해설을 쓴다.
 *
 * **표는 AI 에게 맡기지 않는다.** 화면의 표는 rows 로 코드가 그리고,
 * 여기서 받는 건 문장뿐이다. 가격을 지어내면 그건 오타가 아니라 사고다.
 * 그래서 문장에 쓸 숫자도 아래 프롬프트에 미리 계산해 넣어 준다.
 */

export const REGION_SLUG: Record<Region, string> = {
  서울: 'seoul',
  '경기·인천': 'gyeonggi',
  부산: 'busan',
  대구: 'daegu',
  대전: 'daejeon',
  광주: 'gwangju',
  강원: 'gangwon',
  제주: 'jeju',
};

const ReportSchema = z.object({
  title: z
    .string()
    .describe('검색에 걸릴 제목. 지역과 날짜를 반드시 넣는다. 예: "서울 휴대폰 성지 시세 (11월 18일 기준)"'),
  summary: z.string().describe('검색 결과에 뜰 두 문장 요약. 160자 안쪽.'),
  lead: z.string().describe('도입 2~3문장. 이번 주 시세가 전체적으로 어떤 분위기인지.'),
  highlights: z.array(z.string()).describe('눈에 띄는 변화 3~5개. 한 줄씩. 숫자는 주어진 값만 쓴다.'),
  closing: z.string().describe('마무리 2~3문장. 지금 사는 게 나은지 기다리는 게 나은지, 주의할 점.'),
});

/** 가격을 사람이 읽는 말로. 음수는 페이백이다. */
const money = (price: number) => (price < 0 ? `${Math.abs(price)}만원 페이백` : `할부원금 ${price}만원`);

const short = (joinType: string) => (joinType === '번호이동' ? '번이' : joinType === '기기변경' ? '기변' : '신규');

export interface WriteInput {
  region: Region;
  datedOn: string;
  rows: SiseRow[];
  note: string;
  comparison: SiseComparison | null;
  previousDate: string | null;
}

export async function writeReport(input: WriteInput): Promise<SiseSections & { title: string; summary: string }> {
  const client = anthropic();
  if (!client) throw badRequest('ANTHROPIC_API_KEY 가 없어 글을 쓸 수 없습니다.');

  const response = await client.messages.parse({
    model: WRITE_MODEL,
    max_tokens: 8000,
    output_config: { format: zodOutputFormat(ReportSchema) },
    messages: [{ role: 'user', content: buildPrompt(input) }],
  });

  if (response.stop_reason === 'refusal') throw badRequest('이 내용으로는 글을 쓸 수 없습니다.');

  const parsed = response.parsed_output;
  if (!parsed) throw badRequest('글을 쓰지 못했습니다. 다시 시도해주세요.');

  return {
    // 제목이 비면 기본 제목으로 — 빈 제목이 발행되는 것보단 낫다
    title: parsed.title.trim().slice(0, 200) || defaultTitle(input),
    summary: parsed.summary.trim().slice(0, 300),
    lead: parsed.lead.trim(),
    highlights: parsed.highlights.map((line) => line.trim()).filter(Boolean).slice(0, 6),
    closing: parsed.closing.trim(),
  };
}

export function defaultTitle({ region, datedOn }: { region: Region; datedOn: string }) {
  const [, month, day] = datedOn.split('-');
  return `${region} 휴대폰 성지 시세 (${Number(month)}월 ${Number(day)}일 기준)`;
}

function buildPrompt(input: WriteInput): string {
  const { region, datedOn, rows, note, comparison, previousDate } = input;
  const lines: string[] = [];

  lines.push(
    `너는 휴대폰 커뮤니티 "찍고"의 편집자다. ${region} 지역 ${datedOn} 기준 시세표를 보고 해설 글을 쓴다.`,
    '',
    '## 지켜야 할 것',
    '- **주어진 숫자만 쓴다.** 아래에 없는 가격을 지어내지 마라. 하나 틀리면 글 전체를 못 믿는다.',
    '- 표는 화면에 따로 그려지니 표를 글로 옮기지 마라. 흐름과 뜻을 설명해라.',
    '- "최저가", "역대급", "지금이 기회" 같은 과장은 쓰지 마라. 숫자가 말하게 둔다.',
    '- 특정 매장을 광고하지 마라. 매장 이름은 모른다.',
    '- 음수는 페이백이다. -75 는 "75만원 페이백" 이고, 손님이 돈을 받는 것이다.',
    '- 존댓말로, 담백하게 쓴다.',
    '',
    `## ${datedOn} ${region} 시세 (기종별 가장 싼 조건)`,
  );

  for (const row of lowestByModel(rows).slice(0, 14)) {
    lines.push(`- ${row.model} ${row.storage}: ${money(row.price)} (${row.carrier} ${short(row.joinType)}, ${row.plan})`);
  }

  if (note) lines.push('', `## 표에 붙은 조건`, note);

  if (comparison && previousDate) {
    lines.push(
      '',
      `## ${previousDate} 대비 변화`,
      `싸진 칸 ${comparison.cheaper}개 · 비싸진 칸 ${comparison.pricier}개 · 그대로 ${comparison.same}개`,
      '',
      '많이 움직인 것:',
    );
    for (const change of comparison.changes.slice(0, 10)) {
      const dir = change.delta < 0 ? '좋아짐' : '나빠짐';
      lines.push(
        `- ${change.model} (${change.carrier} ${short(change.joinType)}): ${money(change.before)} → ${money(change.after)}` +
          ` / ${Math.abs(change.delta)}만원 ${dir}`,
      );
    }
    if (comparison.added.length) lines.push('', `새로 들어온 기종: ${comparison.added.join(', ')}`);
    if (comparison.removed.length) lines.push(`빠진 기종: ${comparison.removed.join(', ')}`);
  } else {
    lines.push('', '## 변화', '이 지역의 첫 기록이라 견줄 지난 시세가 없다. 비교 이야기는 쓰지 말고 현재 상황만 설명해라.');
  }

  lines.push(
    '',
    '## 쓸 것',
    '- title: 지역과 날짜가 들어간 제목. 검색해서 들어오는 글이라 "서울 휴대폰 성지 시세" 같은 말이 앞에 와야 한다.',
    '- summary: 검색 결과에 뜰 두 문장.',
    '- lead: 이번 시세 분위기 2~3문장.',
    '- highlights: 눈에 띄는 것 3~5줄.',
    '- closing: 사는 쪽이 나은지 기다리는 쪽이 나은지, 볼 때 주의할 점 2~3문장.',
  );

  return lines.join('\n');
}
