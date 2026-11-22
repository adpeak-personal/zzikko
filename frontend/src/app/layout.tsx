import type { Metadata } from 'next';
import { SITE } from '@/config/brand';
import { DEFAULT_OG_IMAGE, SITE_URL } from '@/lib/seo';
import './globals.css';

/**
 * `metadataBase` 가 있어야 og:image 에 상대경로를 쓸 수 있고, 카톡·트위터가
 * 주소를 제대로 푼다. 없으면 Next 가 빌드마다 경고를 띄우고 localhost 로 찍는다.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: 'ko_KR',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [DEFAULT_OG_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 외부 폰트를 못 불러오면 시스템 한글 글꼴로 표시된다 */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      {/* 화면 껍데기(헤더·사이드바)는 (cafe) / (admin) 레이아웃이 각각 만든다 */}
      <body className="flex min-h-screen flex-col">{children}</body>
    </html>
  );
}
