import type { MetadataRoute } from 'next';
import { apiGetPublic } from '@/lib/api.server';
import { SITE_URL } from '@/lib/seo';

/**
 * 사이트맵.
 *
 * 시세 리포트(/sise)는 사이트 메뉴에 걸지 않으므로 검색엔진이 여기서만 찾아간다.
 * 한 시간마다 다시 만든다 — 글이 올라올 때마다 만들 이유는 없다.
 *
 * ⚠️ **쿠키를 읽는 `apiGet` 을 쓰지 말 것.** `cookies()` 를 부르는 순간 이 길이
 * 동적으로 바뀌어 아래 `revalidate` 가 무용지물이 된다. 그러면 크롤러가 두드릴
 * 때마다 글 2만 건을 DB 에서 긁는다. 로그인과 무관한 내용이라 쿠키도 필요 없다.
 */
export const revalidate = 3600;


/** 기사·기종은 posts 와 다른 테이블이라 백엔드가 따로 내려준다 */
interface ContentEntry {
  id: number;
  boardSlug: string;
  updatedAt: string;
}

interface SitemapData {
  posts: ContentEntry[];
  sise: { slug: string; updatedAt: string }[];
  boards: string[];
  compare: string[];
  news: ContentEntry[];
  specs: ContentEntry[];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/sise`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/compare`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/seller`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/guide`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ];

  // 백엔드가 잠깐 안 되더라도 빈 사이트맵보다는 고정 주소라도 내보낸다
  const data = await apiGetPublic<SitemapData>('/sitemap', revalidate);
  if (!data) return fixed;

  const entry = (
    item: ContentEntry,
    changeFrequency: 'weekly' | 'monthly',
    priority: number,
  ) => ({
    url: `${SITE_URL}/board/${item.boardSlug}/${item.id}`,
    lastModified: new Date(item.updatedAt),
    changeFrequency,
    priority,
  });

  return [
    ...fixed,
    ...data.boards.map((slug) => ({
      url: `${SITE_URL}/board/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.6,
    })),
    // 시세 리포트 — 사이트 안에 링크가 적어서 사이트맵 비중이 크다
    ...data.sise.map((item) => ({
      url: `${SITE_URL}/sise/${item.slug}`,
      lastModified: new Date(item.updatedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    // 비교 페이지 — 사이트 안에 링크가 적어 사이트맵이 중요한 쪽이다
    ...(data.compare ?? []).map((slug) => ({
      url: `${SITE_URL}/compare/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // 기사 — 검색에 걸리라고 쓰는 글이라 회원 글보다 높게 둔다
    ...(data.news ?? []).map((item) => entry(item, 'weekly', 0.7)),
    // 기종 사양 — 한 번 쓰면 거의 안 바뀐다
    ...(data.specs ?? []).map((item) => entry(item, 'monthly', 0.6)),
    ...data.posts.map((post) => entry(post, 'weekly', 0.5)),
  ];
}
