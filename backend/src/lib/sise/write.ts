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
    .describe('검색에 걸릴 제목. 지역과 날짜를 반드시 넣는다. 예: "수원 휴대폰 성지 시세 (11월 20일 기준)"'),
  summary: z.string().describe('검색 결과에 뜰 두 문장 요약. 160자 안쪽.'),
  lead: z
    .string()
    .describe('도입 3~4문장. 블로그 글 첫 문단처럼 자연스럽게. 이번 시세가 어떤 분위기인지.'),
  blocks: z
    .array(
      z.object({
        heading: z.string().describe('소제목. 20자 안쪽. "눈에 띄는 것" 같은 뻔한 말 말고 내용이 드러나게.'),
        body: z.string().describe('문단 2~4개. 줄바꿈 두 번으로 문단을 나눈다. 목록처럼 끊어 쓰지 마라.'),
      }),
    )
    .describe('본문 4~6덩어리. 아래 "글의 뼈대" 순서를 따른다.'),
  closing: z.string().describe('마무리 2~3문장. 과장 없이, 읽는 사람이 다음에 뭘 하면 되는지.'),
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
    blocks: parsed.blocks
      .map((block) => ({ heading: block.heading.trim(), body: block.body.trim() }))
      .filter((block) => block.heading && block.body)
      .slice(0, 8),
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
  const lowest = lowestByModel(rows);

  lines.push(
    `너는 휴대폰 시세를 오래 지켜본 IT 블로거다. 커뮤니티 "찍고"에 ${region} ${datedOn} 기준`,
    '시세 글을 쓴다. 보고서가 아니라 **사람이 읽는 블로그 글**이다.',
    '',
    '## 문체',
    '- 문단으로 쓴다. 한 줄짜리 항목을 늘어놓지 마라. 문장이 이어져야 읽힌다.',
    '- 존댓말. "~합니다", "~인데요" 처럼 말하듯이. 다만 들뜨지는 않게.',
    '- "표에 따르면", "위 표를 보면" 같은 말을 쓰지 마라. 네가 직접 시세를 본 사람처럼 쓴다.',
    '- "역대급", "지금이 기회", "최저가" 같은 과장은 쓰지 마라. 숫자가 말하게 둔다.',
    '- 소제목은 내용이 드러나게 짓는다. "눈에 띄는 것" 같은 빈 제목은 쓰지 마라.',
    '',
    '## 절대 지킬 것',
    '- **아래 주어진 숫자만 쓴다.** 없는 가격을 지어내면 글 전체를 못 믿는다.',
    '- 어떤 기종이 새 것인지 인기인지는 이름으로 판단해도 된다. 다만 **가격·사양 숫자는 주어진 것만** 쓴다.',
    '- 특정 매장을 광고하지 마라. 매장 이름은 모른다.',
    '- 음수는 페이백이다. -30 은 "30만원 페이백", 손님이 돈을 받는 것이다.',
    '- 링크를 글에 쓰지 마라. 화면이 알아서 붙인다.',
    '- **자료가 없다는 말을 글에 쓰지 마라.** "제가 가진 자료로는 말씀드릴 수 없다" 같은 문장은',
    '  읽는 사람에게 아무 쓸모가 없다. 쓸 게 없으면 그냥 그 얘기를 안 하면 된다.',
    '',
    `## ${datedOn} ${region} 시세 — 기종별 가장 싼 조건`,
  );

  for (const row of lowest.slice(0, 16)) {
    lines.push(`- ${row.model} ${row.storage}: ${money(row.price)} (${row.carrier} ${short(row.joinType)}, ${row.plan} 요금제)`);
  }

  const payback = lowest.filter((row) => row.price < 0);
  const paid = lowest.filter((row) => row.price >= 0);
  if (payback.length) {
    lines.push('', `페이백으로 나온 기종 ${payback.length}개: ${payback.map((r) => r.model).join(', ')}`);
  }
  if (paid.length > 1) {
    const cheapest = paid[0]!;
    const dearest = paid[paid.length - 1]!;
    lines.push(
      `할부원금이 붙는 기종은 ${cheapest.model}(${cheapest.price}만원)부터 ${dearest.model}(${dearest.price}만원)까지다.`,
    );
  }

  const gap = joinTypeGap(rows);
  const wins = carrierWins(lowest);
  lines.push('', '## 어떻게 사야 싼지 — 계산해둔 값');
  if (gap) {
    lines.push(
      `- 같은 기종·같은 통신사끼리 견주면 번호이동이 기기변경보다 평균 ${gap.average}만원 싸다 (견준 짝 ${gap.pairs}개).`,
      `  번호이동이 더 싼 경우가 ${gap.mnpCheaper}개, 기기변경이 더 싼 경우가 ${gap.deviceCheaper}개다.`,
    );
  }
  if (wins.length) {
    lines.push(`- 기종별 가장 싼 조건을 통신사로 세면 ${wins.map((w) => `${w.carrier} ${w.count}개`).join(' · ')} 다.`);
  }
  lines.push(
    '- 요금제는 기종마다 다르게 붙어 있다(위 목록 괄호 안). 싼 값에는 그만한 요금제 조건이 따라붙는다.',
  );

  if (note) lines.push('', '## 시세표에 적힌 조건', note);

  if (comparison && previousDate) {
    lines.push(
      '',
      `## ${previousDate} 대비 변화`,
      `싸진 칸 ${comparison.cheaper}개 · 비싸진 칸 ${comparison.pricier}개 · 그대로 ${comparison.same}개`,
      '',
      '많이 움직인 것:',
    );
    for (const change of comparison.changes.slice(0, 10)) {
      const dir = change.delta < 0 ? '손님에게 유리해짐' : '불리해짐';
      lines.push(
        `- ${change.model} (${change.carrier} ${short(change.joinType)}): ${money(change.before)} → ${money(change.after)}` +
          ` / ${Math.abs(change.delta)}만원 ${dir}`,
      );
    }
    if (comparison.added.length) lines.push('', `새로 들어온 기종: ${comparison.added.join(', ')}`);
    if (comparison.removed.length) lines.push(`빠진 기종: ${comparison.removed.join(', ')}`);
  } else {
    lines.push('', '## 변화', '이 지역의 첫 기록이라 견줄 지난 시세가 없다. 변화 이야기는 쓰지 마라.');
  }

  lines.push(
    '',
    '## 성지가 싼 이유 (설명용 배경 — 숫자를 지어내지 마라)',
    '휴대폰 값은 출고가에서 **공시지원금**을 빼고, 거기에 판매점이 쓸 수 있는 **추가지원금**을 더 뺀 금액이다.',
    '일반 대리점은 추가지원금을 거의 안 쓰거나 조금만 쓰는 데 비해, 이른바 성지는 그 폭을 크게 써서',
    '할부원금을 낮추거나 페이백을 준다. 그래서 같은 기종·같은 요금제라도 어디서 가입하느냐로 값이 갈린다.',
    '이 차이를 설명하되, **일반 매장이 얼마다 같은 구체적인 숫자는 쓰지 마라** — 우리가 가진 자료가 아니다.',
    '',
    '## 글의 뼈대 (blocks 를 이 순서로)',
    '1. **이번에 특히 싼 기종** — 페이백이나 할부원금이 낮게 잡힌 것들. 왜 눈에 띄는지까지.',
    '2. **새 기종·많이 찾는 기종 값** — 최신 플래그십과 폴더블이 어느 선에 있는지.',
    '3. **어떻게 사야 싼가** — 번호이동/기기변경, 통신사 선택, 요금제 조건. 위 계산값을 근거로.',
    comparison && previousDate
      ? '4. **지난번과 뭐가 달라졌나** — 움직인 기종과 방향.'
      : '4. (지난 기록이 없으니 이 덩어리는 건너뛴다)',
    '5. **왜 성지가 더 싼가** — 위 배경 설명을 블로그 말투로 풀어서.',
    '',
    '## 쓸 것',
    '- title: 지역과 날짜가 앞에 오는 제목.',
    '- summary: 검색 결과에 뜰 두 문장.',
    '- lead: 블로그 첫 문단처럼 3~4문장.',
    '- blocks: 위 뼈대대로 4~6덩어리. 각 덩어리는 문단 2~4개.',
    '- closing: 2~3문장. 재고·조건은 바뀔 수 있으니 확인하라는 당부까지.',
  );

  return lines.join('\n');
}

/**
 * 같은 기종·같은 통신사에서 번호이동과 기기변경이 얼마나 벌어지는지.
 *
 * "번이가 유리하다"는 말을 **이 시세표의 숫자로** 뒷받침하기 위한 값이다.
 * 짝이 맞는 칸만 센다 — 한쪽에만 있는 기종을 섞으면 평균이 엉뚱해진다.
 */
function joinTypeGap(rows: SiseRow[]) {
  const byKey = new Map<string, Partial<Record<'번호이동' | '기기변경', number>>>();
  for (const row of rows) {
    if (row.joinType === '신규가입') continue;
    const key = `${row.model}|${row.storage}|${row.carrier}`;
    const slot = byKey.get(key) ?? {};
    // 같은 칸이 여러 번 나오면 싼 쪽을 둔다
    const kept = slot[row.joinType];
    if (kept === undefined || row.price < kept) slot[row.joinType] = row.price;
    byKey.set(key, slot);
  }

  let total = 0;
  let pairs = 0;
  let mnpCheaper = 0;
  let deviceCheaper = 0;
  for (const slot of byKey.values()) {
    const mnp = slot['번호이동'];
    const device = slot['기기변경'];
    if (mnp === undefined || device === undefined) continue;
    total += device - mnp; // 양수면 번이가 싸다
    pairs += 1;
    if (mnp < device) mnpCheaper += 1;
    else if (device < mnp) deviceCheaper += 1;
  }

  if (pairs === 0) return null;
  return { average: Math.round((total / pairs) * 10) / 10, pairs, mnpCheaper, deviceCheaper };
}

/** 기종별 가장 싼 조건을 통신사로 센다 — "어디가 공격적인지" 근거 */
function carrierWins(lowest: SiseRow[]) {
  const count = new Map<string, number>();
  for (const row of lowest) count.set(row.carrier, (count.get(row.carrier) ?? 0) + 1);
  return [...count.entries()]
    .map(([carrier, n]) => ({ carrier, count: n }))
    .sort((a, b) => b.count - a.count);
}
