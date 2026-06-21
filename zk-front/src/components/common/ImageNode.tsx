"use client";

import { Image as TiptapImage } from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";

function pickImg(el: HTMLElement): HTMLImageElement | null {
  return el.tagName === "IMG"
    ? (el as HTMLImageElement)
    : el.querySelector("img");
}

function ImageView({ node, selected, deleteNode }: NodeViewProps) {
  const { src, alt, title, textAlign } = node.attrs as {
    src: string;
    alt?: string;
    title?: string;
    textAlign?: string;
  };

  const justify =
    textAlign === "center"
      ? "center"
      : textAlign === "right"
        ? "flex-end"
        : "flex-start";

  return (
    <NodeViewWrapper style={{ display: "flex", justifyContent: justify }} className="my-3">
      <span
        contentEditable={false}
        className={`relative inline-block max-w-full rounded-lg overflow-hidden transition-all ${
          selected ? "ring-2 ring-blue-400" : ""
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt ?? ""}
          title={title ?? undefined}
          className="block max-w-full h-auto select-none"
          draggable={false}
        />
        {selected && (
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              deleteNode();
            }}
            className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-slate-800/80 hover:bg-red-500 text-white flex items-center justify-center text-sm transition-colors"
            title="이미지 삭제"
          >
            ✕
          </button>
        )}
      </span>
    </NodeViewWrapper>
  );
}

/**
 * 기본 Image 노드를 확장.
 * - React NodeView 로 선택 표시 + 삭제(X) 버튼 제공
 * - <div> 래퍼로 렌더하여 TextAlign 정렬이 에디터/저장 HTML 양쪽에서 동작
 *   (img 는 inline 이라 래퍼 div 의 text-align 으로 좌/중앙/우 정렬됨)
 * - 노드 이름은 "image" 그대로 → setImage 커맨드/스키마 그대로 사용
 */
export const ImageNode = TiptapImage.extend({
  // 래퍼 div 에서 자식 img 의 속성을 읽어오도록 parse 재정의
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (el) => pickImg(el as HTMLElement)?.getAttribute("src") ?? null,
      },
      alt: {
        default: null,
        parseHTML: (el) => pickImg(el as HTMLElement)?.getAttribute("alt") ?? null,
      },
      title: {
        default: null,
        parseHTML: (el) => pickImg(el as HTMLElement)?.getAttribute("title") ?? null,
      },
    };
  },

  parseHTML() {
    return [
      { tag: "div[data-image]" }, // 정렬 래퍼 포함 (이 에디터가 저장한 형식)
      { tag: "img[src]" }, // 일반 img (이전 글/외부 붙여넣기 호환)
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // HTMLAttributes 에는 src/alt/title 과 (TextAlign 전역 속성이 넣은) style: text-align 이 섞여 있다.
    // style(정렬)은 래퍼 div 로, 나머지는 img 로 분리한다.
    const { style, ...imgAttrs } = HTMLAttributes as Record<string, unknown>;
    return [
      "div",
      mergeAttributes({ "data-image": "true" }, style ? { style } : {}),
      ["img", mergeAttributes(this.options.HTMLAttributes, imgAttrs)],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
