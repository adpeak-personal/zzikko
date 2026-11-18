import type { MetadataRoute } from 'next';
import { apiGet } from '@/lib/api.server';

/**
 * 사이트맵.
 *
 * 시세 리포트(/sise)는 사이트 메뉴에 걸지 않으므로 검색엔진이 여기서만 찾아간다.
 * 한 시간마다 다시 만든다 — 글이 올라올 때마다 만들 이유는 없다.
 */
export const revalidate = 3600;

const SITE = process.env.SITE_URL ?? 'https://zzikko.co.kr';

interface SitemapData {
  posts: { id: number; boardSlug: string; updatedAt: string }[];
  sise: { slug: string; updatedAt: string }[];
  boards: string[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    { url: SITE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE}/sise`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/seller`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE}/guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  let data: SitemapData;
  try {
    data = await apiGet<SitemapData>('/sitemap');
  } catch {
    // 백엔드가 잠깐 안 되더라도 빈 사이트맵보다는 고정 주소라도 내보낸다
    return fixed;
  }

  return [
    ...fixed,
    ...data.boards.map((slug) => ({
      url: `${SITE}/board/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    // 시세 리포트 — 사이트 안에 링크가 적어서 사이트맵 비중이 크다
    ...data.sise.map((item) => ({
      url: `${SITE}/sise/${item.slug}`,
      lastModified: new Date(item.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...data.posts.map((post) => ({
      url: `${SITE}/board/${post.boardSlug}/${post.id}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
  ];
}
