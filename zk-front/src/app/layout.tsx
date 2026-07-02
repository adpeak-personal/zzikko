import type { Metadata } from "next";
import "./globals.css";
import QueryProvider from "@/components/providers/QueryProvider";
import AuthProvider from "@/components/providers/AuthProvider";
import { siteConfig, absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: siteConfig.titleDefault,
    template: siteConfig.titleTemplate,
  },
  description: siteConfig.description,
  applicationName: siteConfig.siteName,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.siteName, url: siteConfig.siteUrl }],
  creator: siteConfig.siteName,
  publisher: siteConfig.siteName,
  alternates: {
    canonical: "/",
    types: {
      "application/rss+xml": [
        { url: "/rss.xml", title: `${siteConfig.siteName} RSS` },
      ],
    },
  },
  openGraph: {
    type: "website",
    url: siteConfig.siteUrl,
    siteName: siteConfig.siteName,
    title: siteConfig.titleDefault,
    description: siteConfig.description,
    locale: siteConfig.locale,
    images: [
      {
        url: absoluteUrl(siteConfig.ogImage),
        width: 1200,
        height: 630,
        alt: siteConfig.siteName,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.titleDefault,
    description: siteConfig.description,
    images: [absoluteUrl(siteConfig.ogImage)],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/jjikgo-favicon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  verification: {
    google: siteConfig.googleVerification,
    other: siteConfig.naverVerification
      ? { "naver-site-verification": siteConfig.naverVerification }
      : undefined,
  },
  category: "shopping",
};

// 사이트 전역 JSON-LD (검색결과의 사이트링크·검색박스 노출 근거)
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteConfig.siteUrl}/#organization`,
      name: siteConfig.siteName,
      url: siteConfig.siteUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteConfig.siteUrl}/logo.png`,
      },
    },
    {
      "@type": "WebSite",
      "@id": `${siteConfig.siteUrl}/#website`,
      name: siteConfig.siteName,
      alternateName: siteConfig.titleDefault,
      url: siteConfig.siteUrl,
      description: siteConfig.description,
      inLanguage: "ko-KR",
      publisher: { "@id": `${siteConfig.siteUrl}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${siteConfig.siteUrl}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
