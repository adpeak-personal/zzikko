import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';


/**
 * 크롤러 안내.
 *
 * /sise 는 **막지 않는다.** 사이트 메뉴에 안 걸릴 뿐 검색에 걸리라고 만든 글이다.
 * 로그인·어드민·글쓰기처럼 색인될 이유가 없는 곳만 막는다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/admin/', '/write', '/mypage', '/login', '/signup', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
