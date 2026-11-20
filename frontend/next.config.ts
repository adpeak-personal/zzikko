import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Docker 이미지용. .next/standalone 에 실행에 필요한 파일만 모인다 (frontend/Dockerfile).
  output: 'standalone',
  // ⚠️ rewrite 프록시는 기본 30초에서 끊고 Next 가 평문 "Internal Server Error" 500 을 돌려준다.
  // 우리 응답 형식이 아니라 화면엔 "요청을 처리하지 못했습니다" 만 뜨고 원인이 안 보인다.
  // 시세표 읽기는 칸이 많으면 40초를 넘기므로(실측 41초) 넉넉히 둔다.
  // 백엔드가 멀쩡히 일을 끝냈는데 프론트만 포기하는 상황을 막기 위한 값이다.
  experimental: { proxyTimeout: 180_000 },
  // rewrites 는 빌드할 때 박힌다 — Docker 빌드에서는 API_URL 을 빌드 인자로 넘긴다.
  async rewrites() {
    const api = process.env.API_URL ?? 'http://127.0.0.1:4080';
    return [
      // 브라우저에서 부르는 /api/* 는 Fastify 백엔드로 넘긴다.
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      // 업로드한 이미지도 마찬가지. 업로드 API 가 `/uploads/...` 를 돌려주는데,
      // 그대로 두면 브라우저가 프론트(4050)에서 찾다가 404 가 난다.
      // GCS 를 켜면 주소가 버킷을 가리키므로 이 rewrite 는 그냥 안 쓰인다.
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
