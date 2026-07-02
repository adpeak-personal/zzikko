import type { Metadata } from "next";
import { CATEGORIES } from "@/config/navigation";

/**
 * SEO 상수 — 사이트 전역에서 참조되는 하나의 소스 오브 트루스.
 * 도메인/네이버·구글 verification 등 배포 시점 값은 env 로 오버라이드 가능.
 */
export const siteConfig = {
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") || "https://zzikko.co.kr",
  siteName: "찍고",
  titleDefault:
    "찍고 - 휴대폰성지 / 인터넷 가입 현금 / 핫딜 정보 가득",
  titleTemplate: "%s | 찍고",
  description:
    "휴대폰성지 / 핸드폰성지 부터 인터넷 가입 현금 사은품 정보, 핫딜 정보와 갤럭시S26 울트라, 아이폰17 프로 등 다양한 휴대폰 정보까지",
  // 별도 OG 이미지가 나오기 전 폴백 — 정사각이라 최적은 아니지만 로고로 커버.
  ogImage: "/logo.png",
  locale: "ko_KR",
  keywords: [
    "휴대폰성지",
    "핸드폰성지",
    "인터넷 가입 현금",
    "인터넷 사은품",
    "핫딜",
    "갤럭시S26 울트라",
    "아이폰17 프로",
    "휴대폰 정보",
    "찍고",
  ],
  twitterHandle: undefined as string | undefined,
  naverVerification: process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION,
  googleVerification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
} as const;

/** siteUrl 을 기준으로 절대 URL 만들기 (leading `/` 유지). */
export function absoluteUrl(path: string): string {
  if (!path) return siteConfig.siteUrl;
  if (/^https?:\/\//i.test(path)) return path;
  return `${siteConfig.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/** HTML 태그/엔티티/연속 공백 제거 후 지정 길이로 자름. */
export function stripHtmlToText(html: string | null | undefined, maxLen = 160): string {
  if (!html) return "";
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}

/**
 * 카테고리 페이지 metadata 팩토리.
 * 각 `/category/<slug>/page.tsx` 에서:
 *   export const metadata = categoryMetadata("hotdeal");
 */
export function categoryMetadata(slug: string, subSlug?: string): Metadata {
  const board = CATEGORIES.find((c) => c.slug === slug);
  const sub = subSlug ? board?.subs?.find((s) => s.slug === subSlug) : undefined;

  const boardTitle = board?.title ?? slug;
  const title = sub ? `${boardTitle} · ${sub.title}` : boardTitle;
  const desc = board?.desc
    ? `${board.desc} — ${siteConfig.description}`
    : siteConfig.description;

  const path = subSlug
    ? `/category/${slug}/${subSlug}`
    : `/category/${slug}`;

  return {
    title,
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${siteConfig.siteName}`,
      description: desc,
      url: absoluteUrl(path),
      siteName: siteConfig.siteName,
      locale: siteConfig.locale,
      type: "website",
      images: [{ url: absoluteUrl(siteConfig.ogImage) }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteConfig.siteName}`,
      description: desc,
      images: [absoluteUrl(siteConfig.ogImage)],
    },
  };
}

/**
 * 게시글 상세 metadata 팩토리.
 * 각 `/posts/<slug>/[id]/page.tsx` 의 generateMetadata 에서:
 *   const post = await fetchPostDetail(id);
 *   return postMetadata(post, "blog");
 */
export function postMetadata(
  post: {
    id: number;
    title: string;
    content: string;
    thumbnail_url?: string | null;
    created_at: string;
    board_slug: string;
    author?: string | null;
  } | null,
  fallbackSlug: string,
): Metadata {
  if (!post) {
    // fetch 실패/삭제 글: 폴백 — 기본 카테고리 메타
    return categoryMetadata(fallbackSlug);
  }
  const board = CATEGORIES.find((c) => c.slug === post.board_slug);
  const desc = stripHtmlToText(post.content, 160) || siteConfig.description;
  const path = `/posts/${post.board_slug}/${post.id}`;
  const image = post.thumbnail_url
    ? absoluteUrl(post.thumbnail_url)
    : absoluteUrl(siteConfig.ogImage);

  return {
    title: post.title,
    description: desc,
    alternates: { canonical: path },
    openGraph: {
      title: post.title,
      description: desc,
      url: absoluteUrl(path),
      siteName: siteConfig.siteName,
      locale: siteConfig.locale,
      type: "article",
      publishedTime: post.created_at,
      section: board?.title,
      authors: post.author ? [post.author] : undefined,
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: desc,
      images: [image],
    },
  };
}

/**
 * 게시글 상세 페이지 body 안에 JSON-LD `Article` 스키마를 삽입할 때 사용.
 * <script type="application/ld+json"> 안에 그대로 stringify 해서 넣는다.
 */
export function articleJsonLd(post: {
  id: number;
  title: string;
  content: string;
  thumbnail_url?: string | null;
  created_at: string;
  board_slug: string;
  author?: string | null;
}): Record<string, unknown> {
  const path = `/posts/${post.board_slug}/${post.id}`;
  const desc = stripHtmlToText(post.content, 200);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: desc,
    image: post.thumbnail_url
      ? [absoluteUrl(post.thumbnail_url)]
      : [absoluteUrl(siteConfig.ogImage)],
    datePublished: post.created_at,
    dateModified: post.created_at,
    author: post.author ? { "@type": "Person", name: post.author } : undefined,
    publisher: {
      "@type": "Organization",
      name: siteConfig.siteName,
      logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png") },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(path) },
  };
}
