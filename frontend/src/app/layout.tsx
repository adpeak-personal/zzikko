import type { Metadata } from 'next';
import { SITE } from '@/config/brand';
import './globals.css';

export const metadata: Metadata = {
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
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
