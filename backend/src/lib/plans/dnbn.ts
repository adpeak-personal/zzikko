import type { PlanInput } from '../../repositories/plans.js';

/**
 * 동네방네 알뜰폰(dnbn.co.kr/mvno/list) 요금제 목록 가져오기.
 *
 * 서버가 HTML 로 그려 주는 페이지라(쪽마다 10개, `?pg=N`) 받아서 카드를 읽는다.
 * robots.txt 는 전부 허용(`Allow: /`)이다. 그래도 남의 서버라 **쪽 사이에 쉬고**,
 * 사람이 버튼을 눌렀을 때만 돈다.
 *
 * ⚠️ 카드 HTML 이 바뀌면 여기만 고치면 된다. 읽은 게 0개면 저장하지 않고 실패로 돌려준다 —
 * 그대로 저장하면 "목록에 없음 = 판매 종료" 로 전부 내려간다.
 */
export const DNBN = {
  source: 'dnbn',
  name: '동네방네 알뜰폰',
  home: 'https://dnbn.co.kr/mvno/list',
};

const BASE = 'https://dnbn.co.kr';
const MAX_PAGES = 40;
const PAUSE_MS = 1200;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

/** 태그를 걷어 내고 공백을 하나로 */
function text(html: string | undefined): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (whole, code: string) => {
      if (ENTITIES[code]) return ENTITIES[code];
      if (code.startsWith('#x')) return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
      return whole;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const first = (re: RegExp, html: string) => text(re.exec(html)?.[1]);
const all = (re: RegExp, html: string) => [...html.matchAll(re)].map((m) => text(m[1])).filter(Boolean);
const block = (re: RegExp, html: string) => re.exec(html)?.[1] ?? '';

/** "14,850원" → 14850 */
function won(value: string | undefined): number | null {
  const m = /([\d,]+)\s*원/.exec(value ?? '');
  return m?.[1] ? Number(m[1].replace(/,/g, '')) : null;
}

/** "15GB" → 15, "11GB+일2" → 11 (+하루 2GB), "무제한" → 무제한 */
function parseData(value: string): { dataGb: number | null; dailyGb: number | null; unlimited: boolean } {
  if (/무제한/.test(value)) return { dataGb: null, dailyGb: null, unlimited: true };
  const gb = /([\d.]+)\s*GB/i.exec(value);
  const daily = /일\s*([\d.]+)/.exec(value);
  return { dataGb: gb ? Number(gb[1]) : null, dailyGb: daily ? Number(daily[1]) : null, unlimited: false };
}

/** 망은 통신3사 카드면 깃발, 알뜰폰이면 조건의 "KT LTE" 에서 */
function parseNetwork(flag: string, name: string, conditions: string[], tags: string[]): { network: string; tech: string } {
  for (const item of conditions) {
    const m = /^(SKT|KT|LG U\+)\s+(LTE|5G)$/.exec(item);
    if (m?.[1] && m[2]) return { network: m[1], tech: m[2] };
  }
  // 'SKT' 에도 'KT' 가 들어 있으므로 SK 부터 본다
  const network = /^SK/.test(flag) ? 'SKT' : /LG|U\+/.test(flag) ? 'LG U+' : /KT/.test(flag) ? 'KT' : '';
  const label = `${name} ${tags.join(' ')}`;
  return { network, tech: /5G/.test(label) ? '5G' : /LTE/.test(label) ? 'LTE' : '' };
}

const CARRIER_NAMES: Record<string, string> = { 더원: '더원모바일', 찬스: '찬스모바일' };

/** 카드 하나 → 요금제. 이름조차 못 읽으면 null */
export function parseCard(id: string, html: string): PlanInput | null {
  const flag = first(/<span class="u-flag"[^>]*>(.*?)<\/span>/s, html);
  // 제목 안의 별점(<span class="u-rate">)은 그쪽 회원 후기라 가져오지 않는다
  const name = text(block(/<h3 class="u-cname">(.*?)<\/h3>/s, html).replace(/<span class="u-rate">.*?<\/span>/s, ''));
  if (!name) return null;

  const tags = all(/<span class="u-t2[^"]*">(.*?)<\/span>/gs, html);
  const conditions = all(/<span>(.*?)<\/span>/gs, block(/<div class="u-conds">(.*?)<\/div>/s, html));
  const perks = all(/<li>(.*?)<\/li>/gs, block(/<ul class="u-cperks">(.*?)<\/ul>/s, html));
  const icons = all(/<li>(.*?)<\/li>/gs, block(/<ul class="u-cicons">(.*?)<\/ul>/s, html));

  const dataMatch = /<p class="u-cdata">(.*?)<small>(.*?)<\/small>/s.exec(html);
  const dataText = text(dataMatch?.[1]);

  // 계산표: "1~12개월 / 월 35,200원", "13개월째부터 / 월 55,000원", "기본료(정가) / 77,000원" …
  const calc = new Map<string, string>();
  // 마지막 줄의 </div> 는 블록을 끊는 데 쓰였으므로 붙여 준다
  for (const m of (block(/<div class="u-calc num">(.*?)<\/div>\s*<\/div>/s, html) + '</div>').matchAll(
    /<div[^>]*><span>(.*?)<\/span><(?:span|b)>(.*?)<\/(?:span|b)><\/div>/gs,
  )) {
    calc.set(text(m[1]), text(m[2]));
  }

  const promoKey = [...calc.keys()].find((key) => /^1~\d+개월$/.test(key));
  const afterKey = [...calc.keys()].find((key) => /^\d+개월째부터$/.test(key));
  const bill = won(first(/<span class="u-cbill">(.*?)<\/span>/s, html)) ?? won(calc.get('월 납부액'));

  // 통신3사 카드는 '월 납부액' 이 실제로 내는 돈이고 '체감가' 는 포인트를 뺀 값이다.
  // 체감가를 요금으로 쓰면 0원 요금제처럼 보이므로 쓰지 않는다 — 포인트는 혜택 칸에 적는다.
  const promoPrice = promoKey ? won(calc.get(promoKey)) : null;
  const monthlyFee = bill ?? promoPrice ?? won(first(/<p class="u-cp">(.*?)<\/p>/s, html));
  if (monthlyFee == null) return null;

  const { network, tech } = parseNetwork(flag, name, conditions, tags);
  return {
    sourceId: id,
    carrier: CARRIER_NAMES[flag] ?? flag,
    network,
    tech,
    name,
    tags,
    dataText,
    ...parseData(dataText),
    afterSpeed: text(dataMatch?.[2]),
    voice: icons[0] ?? '',
    sms: icons[1] ?? '',
    monthlyFee,
    promoMonths: promoKey ? Number(/\d+(?=개월)/.exec(promoKey)![0]) : null,
    feeAfterPromo: afterKey ? won(calc.get(afterKey)) : null,
    regularFee: won(calc.get('기본료(정가)') ?? calc.get('기본요금')),
    benefit: first(/<p class="u-cs">(.*?)<\/p>/s, html),
    perks,
    conditions: conditions.filter((item) => item !== `${network} ${tech}`),
    sourceUrl: `${BASE}/mvno/detail/${id}`,
  };
}

/** 한 쪽의 카드들과 전체 쪽 수 */
export function parsePage(html: string): { plans: PlanInput[]; pages: number } {
  const plans: PlanInput[] = [];
  for (const m of html.matchAll(/<article class="u-card[^"]*" id="plan-([\w-]+)">(.*?)<\/article>/gs)) {
    const plan = m[1] && m[2] ? parseCard(m[1], m[2]) : null;
    if (plan) plans.push(plan);
  }
  const pages = Number(/\d+\/(\d+)쪽/.exec(text(html))?.[1] ?? 1);
  return { plans, pages };
}

async function fetchPage(page: number): Promise<string> {
  const res = await fetch(`${BASE}/mvno/list?pg=${page}`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; zzikko-plan-sync)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`dnbn ${page}쪽 응답 ${res.status}`);
  return res.text();
}

/** 전체 쪽을 돌며 요금제를 모은다. 같은 요금제가 두 번 나오면 처음 것만 */
export async function fetchDnbnPlans(): Promise<PlanInput[]> {
  const first = parsePage(await fetchPage(1));
  const byId = new Map(first.plans.map((plan) => [plan.sourceId, plan]));
  const pages = Math.min(first.pages, MAX_PAGES);

  for (let page = 2; page <= pages; page += 1) {
    await sleep(PAUSE_MS);
    for (const plan of parsePage(await fetchPage(page)).plans) {
      if (!byId.has(plan.sourceId)) byId.set(plan.sourceId, plan);
    }
  }
  return [...byId.values()];
}
