import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/config/navigation";
import { siteConfig } from "@/lib/seo";
import { BACK_API } from "@/lib/backend-url";

// 빌드 타임 prerender 대상에서 제외 — 도커 빌드 중엔 백엔드에 접근이 안 돼 fetch 가 hang 한다.
// 런타임 SSR + Cache-Control 헤더로 CDN/브라우저에서 5분 캐시.
export const dynamic = "force-dynamic";
// (참고) revalidate 를 병기해도 무해하지만 dynamic 이 우선한다.
export const revalidate = 300;

type SitemapPost = { id: number; board_slug: string; updated_at: string };

async function fetchAllPosts(): Promise<SitemapPost[]> {
  try {
    const res = await fetch(`${BACK_API}/api/posts/sitemap`, {
      // 백엔드가 응답 못 하면 5초 안에 포기 — sitemap 이 hang 되면 안 됨.
      signal: AbortSignal.timeout(5000),
      next: { revalidate },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data: SitemapPost[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  // 정적 URL: 홈 + 각 카테고리 + 자유게시판 서브들
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: `${siteConfig.siteUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  for (const cat of CATEGORIES) {
    staticUrls.push({
      url: `${siteConfig.siteUrl}/category/${cat.slug}`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: cat.hiddenFromNav ? 0.5 : 0.8,
    });
    for (const sub of cat.subs ?? []) {
      staticUrls.push({
        url: `${siteConfig.siteUrl}/category/${cat.slug}/${sub.slug}`,
        lastModified: now,
        changeFrequency: "hourly",
        priority: 0.6,
      });
    }
  }

  // 동적 URL: 활성 게시글 (최근 5000개, 백엔드가 정렬)
  const posts = await fetchAllPosts();
  const postUrls: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${siteConfig.siteUrl}/posts/${p.board_slug}/${p.id}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticUrls, ...postUrls];
}
