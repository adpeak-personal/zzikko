"use client";

import { useState, useEffect } from "react";
import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";

interface OgData {
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string | null;
}

function LinkPreviewCard({ node, selected, deleteNode, updateAttributes }: NodeViewProps) {
  const { url, title, description, image, domain } = node.attrs as { url: string } & OgData;
  const [loading, setLoading] = useState(!title);
  const [clicked, setClicked] = useState(false);

  const displayDomain = domain ?? (() => { try { return new URL(url).hostname; } catch { return url; } })();

  useEffect(() => {
    // title이 이미 있으면 저장된 데이터 사용 — API 호출 안 함
    if (title) return;

    let cancelled = false;
    fetch(`/api/og?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: (OgData & { domain: string }) | null) => {
        if (cancelled) return;
        if (data) {
          updateAttributes({
            title: data.title,
            description: data.description,
            image: data.image,
            domain: data.domain,
          });
        }
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]); // url 기준으로만 실행 — attrs 변경에 의한 루프 방지

  const showDelete = selected || clicked;

  return (
    <NodeViewWrapper>
      <div
        contentEditable={false}
        onClick={() => setClicked(true)}
        onBlur={() => setClicked(false)}
        className={`relative flex items-stretch border rounded-xl overflow-hidden my-2 bg-white transition-all cursor-default select-none
          ${selected ? "border-blue-400 ring-2 ring-blue-200" : "border-slate-200"}`}
      >
        {showDelete && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); deleteNode(); }}
            className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-slate-700/80 hover:bg-red-500 text-white flex items-center justify-center text-xs transition-colors"
            title="링크 카드 삭제"
          >
            ✕
          </button>
        )}

        {loading ? (
          <>
            <div className="w-32 shrink-0 bg-slate-100 animate-pulse min-h-[80px]" />
            <div className="flex-1 p-4 space-y-2 flex flex-col justify-center">
              <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-full" />
              <div className="h-3 bg-slate-100 rounded animate-pulse w-1/3" />
            </div>
          </>
        ) : (
          <>
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
            <div className="flex-1 p-4 flex flex-col justify-center min-w-0 pr-8">
              <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
                {title ?? displayDomain}
              </p>
              {description && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {description}
                </p>
              )}
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                🌐 {displayDomain}
              </p>
            </div>
          </>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export const LinkPreviewExtension = Node.create({
  name: "linkPreview",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url:         { default: null },
      title:       { default: null },
      description: { default: null },
      image:       { default: null },
      domain:      { default: null },
    };
  },

  parseHTML() {
    return [{
      tag: 'a[data-link-preview="true"]',
      getAttrs: (el) => {
        const a = el as HTMLAnchorElement;
        return {
          url:         a.href,
          title:       a.dataset.title       || null,
          description: a.dataset.description || null,
          image:       a.dataset.image       || null,
          domain:      a.dataset.domain      || null,
        };
      },
    }];
  },

  renderHTML({ node }) {
    const { url, title, description, image, domain } = node.attrs as Record<string, string | null>;
    return [
      "a",
      mergeAttributes({
        href:                  url,
        "data-link-preview":   "true",
        "data-title":          title,
        "data-description":    description,
        "data-image":          image,
        "data-domain":         domain,
      }),
      url ?? "",
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkPreviewCard);
  },
});
