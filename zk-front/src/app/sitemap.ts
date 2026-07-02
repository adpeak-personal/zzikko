import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/config/navigation";
import { siteConfig } from "@/lib/seo";
import { BACK_API } from "@/lib/backend-url";

// 새 글이 최대 5분 안에 반영되도록 캐싱 (백엔드도 동일 정책).
export const revalidate = 300;

type SitemapPost = { id: number; board_slug: string; updated_at: string };

async function fetchAllPosts(): Promise<SitemapPost[]> {
  try {
    const res = await fetch(`${BACK_API}/api/posts/sitemap`, {
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
