import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
