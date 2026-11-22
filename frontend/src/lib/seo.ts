import { SITE } from '@/config/brand';

/** 공개 주소 앞머리. 사이트맵·canonical·구조화 데이터가 전부 이걸 쓴다. */
export const SITE_URL = process.env.SITE_URL ?? 'https://zzikko.co.kr';

/**
 * 사진이 없는 글·홈이 쓰는 사이트 기본 og 이미지(`public/og.png`, 1200×630).
 * `metadataBase` 가 있어서 상대경로로 적어도 절대주소로 풀린다.
 */
export const DEFAULT_OG_IMAGE = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: `${SITE.name} — ${SITE.tagline}`,
};

/**
 * MySQL DATETIME 을 ISO 8601 로.
 *
 * DB 가 `2026-11-18 16:17:31` 처럼 가운데를 띄어쓰기로 주는데, og 의
 * `article:published_time` 도 schema.org 의 `datePublished` 도 **ISO 8601 을 요구한다.**
 * 형식이 틀리면 조용히 무시되므로 화면상으론 멀쩡해 보인다.
 *
 * ⚠️ 시간대는 붙이지 않는다. 띄어쓰기만 `T` 로 바꾸면 그대로 올바른 ISO 가 되는데,
 * 여기서 `toISOString()` 을 쓰면 **프로세스 시간대 기준으로 9시간이 밀 수 있다** —
 * DB 는 KST, 컨테이너는 UTC 인 경우가 흔하다.
 */
export const iso = (value?: string | null): string | undefined =>
  value ? value.replace(' ', 'T') : undefined;

/**
 * 글 종류 페이지의 openGraph.
 *
 * ⚠️ 페이지가 `openGraph` 를 정의하면 루트 레이아웃 것을 **통째로 덮는다**(Next 규칙).
 * 항목끼리 합쳐지지 않아서 `siteName`·`locale` 이 조용히 사라진다. 여기서 같이 붙인다.
 */
export function articleOg(input: {
  title: string;
  description?: string;
  publishedTime?: string | null;
  modifiedTime?: string | null;
  /** 글에 붙은 첫 사진. 없으면 사이트 기본 이미지 */
  image?: string | null;
}) {
  return {
    type: 'article' as const,
    siteName: SITE.name,
    locale: 'ko_KR',
    title: input.title,
    description: input.description,
    publishedTime: iso(input.publishedTime),
    modifiedTime: iso(input.modifiedTime),
    // 루트 레이아웃의 기본 이미지는 여기까지 안 내려온다(통째로 덮이므로) — 직접 넣는다
    images: [input.image || DEFAULT_OG_IMAGE],
  };
}
