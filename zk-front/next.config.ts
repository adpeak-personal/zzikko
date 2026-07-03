import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // ── 블로그 이관 (2026-07 blog → free/blog) ────────────────────────
      {
        source: "/posts/blog/:id(\\d+)",
        destination: "/posts/community/:id",
        permanent: true,
      },
      { source: "/posts/blog", destination: "/category/community/blog", permanent: true },
      { source: "/category/blog", destination: "/category/community/blog", permanent: true },
      // ── free → community 리브랜딩 + reviews/tips/qna 산하 이관 ────────
      // (2026-07, 색인 신청 직후라 손해 미미. 향후 상위 카테고리 재분류 시 여기 갱신)
      {
        source: "/posts/free/:id(\\d+)",
        destination: "/posts/community/:id",
        permanent: true,
      },
      { source: "/category/free/:sub", destination: "/category/community/:sub", permanent: true },
      { source: "/category/free", destination: "/category/community", permanent: true },
      {
        source: "/posts/reviews/:id(\\d+)",
        destination: "/posts/community/:id",
        permanent: true,
      },
      {
        source: "/posts/tips/:id(\\d+)",
        destination: "/posts/community/:id",
        permanent: true,
      },
      {
        source: "/posts/qna/:id(\\d+)",
        destination: "/posts/community/:id",
        permanent: true,
      },
      { source: "/category/reviews", destination: "/category/community/reviews", permanent: true },
      { source: "/category/tips", destination: "/category/community/tips", permanent: true },
      { source: "/category/qna", destination: "/category/community/qna", permanent: true },
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
