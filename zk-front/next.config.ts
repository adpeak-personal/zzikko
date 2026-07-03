import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // 블로그 카테고리 free/blog 이관 (2026-07 SEO 인덱스 자산 승계용). 개별 상수 우선.
      {
        source: "/posts/blog/:id(\\d+)",
        destination: "/posts/free/:id",
        permanent: true,
      },
      {
        source: "/posts/blog",
        destination: "/category/free/blog",
        permanent: true,
      },
      {
        source: "/category/blog",
        destination: "/category/free/blog",
        permanent: true,
      },
      {
        source: "/posts/:slug((?!.*\\d+$)[^/]+)",
        destination: "/category/:slug",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const backendUrl = process.env.NODE_ENV === "production"
      ? "http://backend:4000"
      : process.env.NEXT_PUBLIC_BACK_API ?? "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  images: {
    // remotePatterns: [
    //   {
    //     protocol: 'https',
    //     hostname: 'storage.googleapis.com',
    //     port: '',
    //     pathname: '/**', // 모든 경로의 이미지를 허용
    //   },
    // ],

    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // 모든 HTTPS 도메인 허용
      },
      {
        protocol: 'http',
        hostname: '**', // 모든 HTTP 도메인 허용 (필요한 경우만)
      },
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
      },
    ],
  },
};

export default nextConfig;
