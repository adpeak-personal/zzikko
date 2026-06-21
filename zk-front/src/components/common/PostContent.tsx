import React from "react";

/**
 * 게시글 본문(HTML)을 렌더링하면서, 에디터에서 저장된 링크 프리뷰 앵커
 * (<a data-link-preview="true" ...>)를 카드 박스 형태로 변환해 보여준다.
 * 카드 데이터(title/description/image/domain)는 작성 시점에 data-* 속성으로
 * 저장돼 있으므로 별도 fetch 없이 정적으로 렌더링한다.
 */

type Segment =
  | { type: "html"; html: string }
  | {
      type: "card";
      url: string;
      title: string | null;
      description: string | null;
      image: string | null;
      domain: string | null;
    };

const LINK_PREVIEW_RE = /<a\b[^>]*\bdata-link-preview="true"[^>]*>.*?<\/a>/gi;

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function getAttr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return m && m[1] ? decodeEntities(m[1]) : null;
}

function parseSegments(html: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  LINK_PREVIEW_RE.lastIndex = 0;
  while ((match = LINK_PREVIEW_RE.exec(html)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "html", html: html.slice(lastIndex, match.index) });
    }
    const tag = match[0];
    segments.push({
      type: "card",
      url: getAttr(tag, "href") ?? "",
      title: getAttr(tag, "data-title"),
      description: getAttr(tag, "data-description"),
      image: getAttr(tag, "data-image"),
      domain: getAttr(tag, "data-domain"),
    });
    lastIndex = match.index + tag.length;
  }
  if (lastIndex < html.length) {
    segments.push({ type: "html", html: html.slice(lastIndex) });
  }
  return segments;
}

function LinkPreviewCard({
  url,
  title,
  description,
  image,
  domain,
}: Extract<Segment, { type: "card" }>) {
  let displayDomain = domain;
  if (!displayDomain) {
    try {
      displayDomain = new URL(url).hostname;
    } catch {
      displayDomain = url;
    }
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="not-prose flex items-stretch border border-slate-200 rounded-xl overflow-hidden my-3 bg-white no-underline hover:border-pink-300 hover:shadow-sm transition-all"
    >
      {image ? (
        <div className="w-32 shrink-0 bg-slate-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-32 shrink-0 bg-slate-100 flex items-center justify-center text-3xl min-h-[80px]">
          🔗
        </div>
      )}
      <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
        <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2 m-0">
          {title ?? displayDomain}
        </p>
        {description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed m-0">
            {description}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1 m-0">
          🌐 {displayDomain}
        </p>
      </div>
    </a>
  );
}

export default function PostContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const segments = parseSegments(html);

  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === "card" ? (
          // OG 이미지가 있으면 카드 박스, 없으면 일반 링크
          seg.image ? (
            <LinkPreviewCard key={i} {...seg} />
          ) : (
            <p key={i} className="my-2">
              <a
                href={seg.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-pink-600 underline break-all"
              >
                {seg.title ?? seg.url}
              </a>
            </p>
          )
        ) : (
          <div key={i} dangerouslySetInnerHTML={{ __html: seg.html }} />
        ),
      )}
    </div>
  );
}
