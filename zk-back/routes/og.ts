import type { FastifyInstance } from 'fastify';
import ogs from 'open-graph-scraper';

function resolveImage(raw: string | undefined, pageUrl: string): string | null {
  if (!raw) return null;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) return `${new URL(pageUrl).origin}${raw}`;
  return raw;
}

export default async function ogRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url: string } }>('/og', async (req, reply) => {
    const { url } = req.query;
    if (!url) return reply.badRequest('url 파라미터가 필요합니다.');
    try { new URL(url); } catch { return reply.badRequest('유효하지 않은 URL입니다.'); }

    const domain = new URL(url).hostname;

    // 1차: 자체 스크래핑
    try {
      const { result, error } = await ogs({
        url,
        timeout: 6000,
        fetchOptions: { headers: { 'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8' } },
      });

      if (!error && result.success) {
        const rawImage = Array.isArray(result.ogImage) ? result.ogImage[0]?.url : result.ogImage?.url;
        const image = resolveImage(rawImage, url);

        // 이미지까지 있으면 바로 반환
        if (image) {
          return {
            url, domain,
            title: result.ogTitle || result.twitterTitle || domain,
            description: result.ogDescription || result.twitterDescription || null,
            image,
          };
        }
      }
    } catch { /* Microlink로 폴백 */ }

    // 2차: Microlink 폴백 (JS 렌더링 사이트 대응)
    try {
      const mlRes = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(8000),
      });
      const ml = await mlRes.json() as {
        status: string;
        data: { title?: string; description?: string; image?: { url: string } };
      };

      if (ml.status === 'success') {
        return {
          url, domain,
          title: ml.data.title || domain,
          description: ml.data.description || null,
          image: ml.data.image?.url || null,
        };
      }
    } catch { /* 최종 실패 */ }

    return reply.serviceUnavailable('OG 데이터를 가져올 수 없습니다.');
  });
}
