'use client';

import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { ImageView } from '@/components/editor/nodes/ImageView';
import { ResizableImage, schemaExtensions } from '@/components/editor/schema';

/**
 * 저장된 본문(ProseMirror JSON)을 읽기 전용으로 그린다.
 *
 * 작성 화면과 같은 스키마를 쓰기 때문에 쓸 때 본 모습 그대로 보인다.
 * HTML 을 서버에서 만들어 내려주는 방식으로 바꾸고 싶다면 이 컴포넌트만 교체하면 된다.
 */
export function EditorContentView({ doc }: { doc: unknown }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      ...schemaExtensions.filter((ext) => ext.name !== ResizableImage.name),
      ResizableImage.extend({ addNodeView: () => ReactNodeViewRenderer(ImageView) }),
    ],
    content: (doc ?? null) as JSONContent | null,
    editorProps: { attributes: { class: 'editor-content' } },
  });

  if (!editor) return <div className="h-24 animate-pulse rounded-lg bg-gray-50" aria-hidden />;
  return <EditorContent editor={editor} />;
}
