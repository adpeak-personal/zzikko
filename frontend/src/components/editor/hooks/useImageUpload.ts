"use client";

import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";
import type { UploadImage } from "../types";

export const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/gif,image/webp";

/**
 * 이미지 업로드 + 본문 삽입.
 *
 * 툴바 버튼, 붙여넣기, 드래그&드롭 세 경로가 모두 이 훅을 쓴다.
 * 삽입 시 현재 문단의 정렬을 이어받아서, 가운데 정렬 상태로 넣으면
 * 이미지도 가운데로 들어간다.
 */
export function useImageUpload(editor: Editor | null, uploadImage?: UploadImage) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const insert = useCallback(
    async (files: File[]) => {
      if (!editor || !uploadImage || files.length === 0) return;

      // 삽입 시점의 정렬 — 현재 블록에 없으면 툴바에서 고정해 둔 값을 쓴다
      const textAlign =
        (editor.getAttributes("paragraph").textAlign as string | undefined) ??
        editor.storage.stickyAlign?.last ??
        null;

      setError(null);
      setUploading(true);
      try {
        for (const file of files) {
          const { url } = await uploadImage(file);
          // 정렬은 삽입 시 attrs 로 함께 넣는다 —
          // updateAttributes 는 삽입 후 선택 위치에 따라 이미지 노드를 못 잡을 수 있다
          editor
            .chain()
            .focus()
            .setImage({ src: url, alt: file.name, ...(textAlign ? { textAlign } : {}) })
            .run();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "이미지 업로드에 실패했어요.");
      } finally {
        setUploading(false);
      }
    },
    [editor, uploadImage],
  );

  /** DataTransfer 에서 이미지 파일만 골라낸다 */
  const filesFrom = useCallback((data: DataTransfer | null) => {
    if (!data) return [];
    return [...data.files].filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type));
  }, []);

  return { uploading, error, setError, insert, filesFrom, enabled: Boolean(uploadImage) };
}
