import { NextResponse } from "next/server";
import { siteConfig } from "@/lib/seo";
import { BACK_API } from "@/lib/backend-url";

// 새 글이 최대 5분 안에 반영되도록 캐싱 (백엔드도 동일 정책).
export const revalidate = 300;

type RssItem = {
  id: number;
  board_slug: string;
  sub_slug: string | null;
  title: string;
  thumbnail_url: string | null;
  excerpt: string;
  author: string | null;
  created_at: string;
  updated_at: string;
};

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toRfc822(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toUTCString();
  return d.toUTCString();
}

async function fetchRss(): Promise<RssItem[]> {
  try {
    const res = await fetch(`${BACK_API}/api/posts/rss?limit=50`, {
      next: { revalidate },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data: RssItem[] };
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function GET() {
  const items = await fetchRss();
  const now = new Date().toUTCString();

  const itemsXml = items
    .map((it) => {
      const link = `${siteConfig.siteUrl}/posts/${it.board_slug}/${it.id}`;
      const guid = link;
      const description = it.excerpt || "";
      const enclosure = it.thumbnail_url
        ? `\n      <enclosure url="${xmlEscape(it.thumbnail_url)}" type="image/webp" />`
        : "";
      const category = xmlEscape(it.sub_slug ? `${it.board_slug}/${it.sub_slug}` : it.board_slug);
      const authorLine = it.author ? `\n      <dc:creator><![CDATA[${it.author}]]></dc:creator>` : "";
      return `    <item>
      <title><![CDATA[${it.title}]]></title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(guid)}</guid>
      <pubDate>${toRfc822(it.created_at)}</pubDate>
      <category>${category}</category>${authorLine}
      <description><![CDATA[${description}]]></description>${enclosure}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${xmlEscape(siteConfig.siteName)}</title>
    <link>${xmlEscape(siteConfig.siteUrl)}</link>
    <description>${xmlEscape(siteConfig.description)}</description>
    <language>ko-KR</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${xmlEscape(siteConfig.siteUrl)}/rss.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    },
  });
}
