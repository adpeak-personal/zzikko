import { z } from 'zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { WRITE_MODEL, anthropic, type Usage } from '../anthropic.js';
import { badRequest } from '../http.js';
import { lowestByModel, type SiseComparison } from './compare.js';
import type { SiseRow, SiseSections } from '../../types.js';

/**
 * 시세표를 놓고 해설을 쓴다.
 *
 * **표는 AI 에게 맡기지 않는다.** 화면의 표는 rows 로 코드가 그리고,
 * 여기서 받는 건 문장뿐이다. 가격을 지어내면 그건 오타가 아니라 사고다.
 * 그래서 문장에 쓸 숫자도 아래 프롬프트에 미리 계산해 넣어 준다.
 */

/**
 * 주소에 쓸 지역 조각.
 *
 * 시세 지역은 자유 문자열이라(수원·부천·강남…) 여기 없는 이름이 들어올 수 있다.
 * 그때는 한글을 그대로 쓴다 — 주소에선 퍼센트 인코딩되지만 동작은 한다.
 * ⚠️ 한글 slug 는 `params.slug` 가 인코딩된 채로 오므로, 받는 쪽에서 **풀고 다시 걸어야**
 *    한다. `/compare/[slug]` 가 같은 함정에 빠진 적이 있다.
 */
const SLUGS: Record<string, string> = {
  서울: 'seoul', 부산: 'busan', 대구: 'daegu', 인천: 'incheon', 대전: 'daejeon',
  광주: 'gwangju', 울산: 'ulsan', 세종: 'sejong', 경기: 'gyeonggi', '경기·인천': 'gyeonggi',
  강원: 'gangwon', 제주: 'jeju',
  // 서울 구·상권
  강남: 'gangnam', 서초: 'seocho', 송파: 'songpa', 강동: 'gangdong', 광진: 'gwangjin',
  성동: 'seongdong', 중랑: 'jungnang', 동대문: 'dongdaemun', 성북: 'seongbuk', 강북: 'gangbuk',
  도봉: 'dobong', 노원: 'nowon', 은평: 'eunpyeong', 서대문: 'seodaemun', 마포: 'mapo',
  양천: 'yangcheon', 강서: 'gangseo', 구로: 'guro', 금천: 'geumcheon', 영등포: 'yeongdeungpo',
  동작: 'dongjak', 관악: 'gwanak', 용산: 'yongsan', 종로: 'jongno',
  신도림: 'sindorim', 강변: 'gangbyeon', 테크노마트: 'technomart', 연신내: 'yeonsinnae',
  // 경기
  수원: 'suwon', 성남: 'seongnam', 고양: 'goyang', 용인: 'yongin', 부천: 'bucheon',
  안산: 'ansan', 안양: 'anyang', 남양주: 'namyangju', 화성: 'hwaseong', 평택: 'pyeongtaek',
  의정부: 'uijeongbu', 시흥: 'siheung', 파주: 'paju', 김포: 'gimpo', 광명: 'gwangmyeong',
  군포: 'gunpo', 하남: 'hanam', 오산: 'osan', 이천: 'icheon', 구리: 'guri',
  분당: 'bundang', 일산: 'ilsan', 동탄: 'dongtan', 판교: 'pangyo', 평촌: 'pyeongchon',
  산본: 'sanbon', 영통: 'yeongtong', 광교: 'gwanggyo',
  // 그 밖
  천안: 'cheonan', 아산: 'asan', 청주: 'cheongju', 전주: 'jeonju', 창원: 'changwon',
  김해: 'gimhae', 진주: 'jinju', 포항: 'pohang', 구미: 'gumi', 경산: 'gyeongsan',
  원주: 'wonju', 춘천: 'chuncheon', 서면: 'seomyeon', 해운대: 'haeundae', 부평: 'bupyeong',
  송도: 'songdo', 청라: 'cheongna',
};

export const regionSlug = (region: string) => SLUGS[region] ?? region;

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
  /** 시 단위까지 들어온다 — '수원', '부천', '강남' */
  region: string;
  datedOn: string;
  rows: SiseRow[];
  note: string;
  comparison: SiseComparison | null;
  previousDate: string | null;
}

export async function writeReport(
  input: WriteInput,
  /** 모델을 바꿔 글맛을 견줄 때만 넘긴다. 평소엔 ANTHROPIC_WRITE_MODEL 을 쓴다. */
  modelOverride?: string,
): Promise<SiseSections & { title: string; summary: string; usage: Usage; model: string }> {
  const client = anthropic();
  if (!client) throw badRequest('ANTHROPIC_API_KEY 가 없어 글을 쓸 수 없습니다.');

  const model = modelOverride ?? WRITE_MODEL;
  const response = await client.messages.parse({
    model,
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
    usage: response.usage,
    model,
  };
}

export function defaultTitle({ region, datedOn }: { region: string; datedOn: string }) {
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
