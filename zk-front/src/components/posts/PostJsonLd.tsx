import { articleJsonLd } from "@/lib/seo";

/**
 * 게시글 상세 페이지 body 에 `Article` JSON-LD 를 삽입한다.
 * 구글/네이버 리치 결과(뉴스/블로그) 노출용.
 */
export default function PostJsonLd({
  post,
}: {
  post: {
    id: number;
    title: string;
    content: string;
    thumbnail_url?: string | null;
    created_at: string;
    board_slug: string;
    author?: string | null;
  };
}) {
  const data = articleJsonLd(post);
  return (
    <script
      type="application/ld+json"
      // 브라우저에 그대로 노출되는 static JSON — dangerouslySetInnerHTML 필요.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
