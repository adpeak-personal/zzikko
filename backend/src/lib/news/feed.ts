/**
 * 뉴스 수집 — RSS 를 읽어 항목으로 바꾼다.
 *
 * 원문 페이지를 긁지 않고 RSS 만 읽는다. 발행자가 가져가라고 내놓은 통로이고,
 * GSMArena 의 경우 본문 앞부분(600자 남짓)이 통째로 들어 있어 요약을 쓰기에 충분하다.
 *
 * 이용 조건은 발행자가 license.xml 로 밝혀 둔다 (RSL 표준).
 * GSMArena: ai-summarize 허용 · 출처 표기(CC BY 4.0) 조건 · 학습 금지.
 * 그래서 원문을 옮기지 않고 요약·재작성하며, 기사에 반드시 출처와 링크를 남긴다.
 */

export interface FeedItem {
  guid: string;
  title: string;
  link: string;
  publishedAt: Date;
  /** RSS 가 준 원문 평문 */
  sourceText: string;
}

export interface NewsSource {
  name: string;
  url: string;
}

/** 지금은 한 곳뿐이지만, 늘릴 때 여기만 고치면 된다 */
export const SOURCES: NewsSource[] = [
  { name: 'GSMArena', url: 'https://www.gsmarena.com/rss-news-reviews.php3' },
];

const unescape = (text: string) =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

/** 태그를 떼고 문단은 살린다 */
function toPlainText(html: string): string {
  return unescape(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/(p|div|li|h\d)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** CDATA 안이 진짜 값이다. 없으면 빈 문자열. */
function cdataOf(text: string): string {
  const parts: string[] = [];
  for (const match of text.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)) {
    const value = match[1];
    if (value) parts.push(value);
  }
  return parts.join('\n');
}

function pick(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  const inner = match?.[1];
  if (!inner) return '';
  return (cdataOf(inner) || inner).trim();
}

/**
 * RSS XML 을 항목으로 바꾼다.
 *
 * description 안이 섞여 있다 — 이스케이프된 `<img>` 와 `<p>` 뒤에 CDATA 로 본문이 들어온다.
 * 그래서 CDATA 를 먼저 꺼내고, 없으면 통째로 태그를 떼어낸다.
 */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    if (!block) continue;

    const title = toPlainText(pick(block, 'title'));
    const link = pick(block, 'link');
    if (!title || !link) continue;

    const rawDescription = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? '';
    const sourceText = toPlainText(cdataOf(rawDescription) || rawDescription);

    const pubDate = pick(block, 'pubDate');
    const published = pubDate ? new Date(pubDate) : new Date();

    items.push({
      guid: (pick(block, 'guid') || link).slice(0, 500),
      title: title.slice(0, 300),
      link: link.slice(0, 500),
      publishedAt: Number.isNaN(published.getTime()) ? new Date() : published,
      sourceText,
    });
  }

  return items;
}

/** 한 곳에서 항목을 받아온다 */
export async function fetchSource(source: NewsSource): Promise<FeedItem[]> {
  const response = await fetch(source.url, {
    // 익명 클라이언트로 둔다 — 사용자 정보를 바깥에 흘리지 않는다
    headers: { 'User-Agent': 'zzikko-news-reader/1.0 (+https://zzikko.co.kr)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`${source.name} 응답이 ${response.status} 입니다.`);
  return parseFeed(await response.text());
}
