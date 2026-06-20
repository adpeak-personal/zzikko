"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Image } from "@tiptap/extension-image";
import { Link } from "@tiptap/extension-link";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { Underline } from "@tiptap/extension-underline";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Highlight } from "@tiptap/extension-highlight";
import { LinkPreviewExtension } from "./LinkPreview";

async function uploadImage(file: File): Promise<string> {
  // TODO: GCS 업로드로 교체
  // const formData = new FormData();
  // formData.append("file", file);
  // const res = await fetch("/api/upload/image", { method: "POST", body: formData });
  // if (!res.ok) throw new Error("upload failed");
  // const { url } = await res.json();
  // return url;
  return URL.createObjectURL(file);
}

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
};

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`min-w-8 h-8 px-2 rounded text-sm border transition-all ${active
          ? "bg-blue-100 text-blue-700 border-blue-400 shadow-[inset_0_2px_4px_rgba(59,130,246,0.25)] translate-y-px"
          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 active:bg-slate-200 active:shadow-inner"
        } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-6 bg-slate-200 mx-1" />;
}

function HtmlPasteModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (html: string) => void;
}) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    if (!open) setHtml("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-[min(800px,92vw)] max-h-[90vh] bg-white rounded-xl shadow-xl border border-slate-200 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800">HTML 붙여넣기</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded hover:bg-slate-100 text-slate-500"
            title="닫기"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col">
            <label className="text-xs text-slate-500 mb-1">HTML 소스</label>
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="<p>여기에 HTML을 붙여넣으세요</p>"
              className="flex-1 min-h-[280px] font-mono text-sm p-3 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs text-slate-500 mb-1">미리보기</label>
            <div
              className="prose-editor flex-1 min-h-[280px] p-3 border border-slate-200 rounded-lg overflow-auto bg-slate-50"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-100"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!html.trim()}
            onClick={() => {
              onConfirm(html);
              onClose();
            }}
            className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [htmlModalOpen, setHtmlModalOpen] = useState(false);
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const rerender = () => forceUpdate((n) => n + 1);
    editor.on("transaction", rerender);
    editor.on("selectionUpdate", rerender);
    editor.on("focus", rerender);
    editor.on("blur", rerender);
    return () => {
      editor.off("transaction", rerender);
      editor.off("selectionUpdate", rerender);
      editor.off("focus", rerender);
      editor.off("blur", rerender);
    };
  }, [editor]);

  const handleImagePick = () => imageInputRef.current?.click();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const url = await uploadImage(file);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      alert("이미지 업로드 실패");
      console.error(err);
    }
  };

  const addLink = useCallback(() => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url, target: "_blank" })
      .run();
  }, [editor]);

  const insertTable = () =>
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();

  const insertHtml = (html: string) => {
    editor.chain().focus().insertContent(html, {
      parseOptions: { preserveWhitespace: "full" },
    }).run();
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
      <select
        className="h-8 px-2 text-sm border border-slate-200 rounded bg-white"
        value={
          editor.isActive("heading", { level: 1 })
            ? "1"
            : editor.isActive("heading", { level: 2 })
              ? "2"
              : editor.isActive("heading", { level: 3 })
                ? "3"
                : "0"
        }
        onChange={(e) => {
          const v = e.target.value;
          if (v === "0") editor.chain().focus().setParagraph().run();
          else
            editor
              .chain()
              .focus()
              .toggleHeading({ level: Number(v) as 1 | 2 | 3 })
              .run();
        }}
      >
        <option value="0">본문</option>
        <option value="1">제목 1</option>
        <option value="2">제목 2</option>
        <option value="3">제목 3</option>
      </select>

      <Divider />

      <ToolbarButton
        title="굵게 (Ctrl+B)"
        active={editor.isActive("bold")}
        onClick={() => { 
          editor.chain().focus().toggleBold().run();
          
         }}
      >
        <b>B</b>
      </ToolbarButton>
      <ToolbarButton
        title="기울임 (Ctrl+I)"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <i>I</i>
      </ToolbarButton>
      <ToolbarButton
        title="밑줄 (Ctrl+U)"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <u>U</u>
      </ToolbarButton>
      <ToolbarButton
        title="취소선"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <s>S</s>
      </ToolbarButton>
      <ToolbarButton
        title="인라인 코드"
        active={editor.isActive("code")}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        {"</>"}
      </ToolbarButton>

      <Divider />

      <label
        className="flex items-center gap-1 h-8 px-2 border border-slate-200 rounded bg-white cursor-pointer text-xs"
        title="글자 색"
      >
        글자색
        <input
          type="color"
          className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer"
          onChange={(e) =>
            editor.chain().focus().setColor(e.target.value).run()
          }
        />
      </label>
      <label
        className="flex items-center gap-1 h-8 px-2 border border-slate-200 rounded bg-white cursor-pointer text-xs"
        title="형광펜"
      >
        🖍
        <input
          type="color"
          defaultValue="#fef08a"
          className="w-5 h-5 border-0 p-0 bg-transparent cursor-pointer"
          onChange={(e) =>
            editor.chain().focus().setHighlight({ color: e.target.value }).run()
          }
        />
      </label>
      <ToolbarButton
        title="형광펜 제거"
        disabled={!editor.isActive("highlight")}
        onClick={() => editor.chain().focus().unsetHighlight().run()}
      >
        🖍✕
      </ToolbarButton>

      <Divider />

      <select
        className="h-8 px-2 text-sm border border-slate-200 rounded bg-white"
        title="정렬"
        value={
          editor.isActive({ textAlign: "center" })
            ? "center"
            : editor.isActive({ textAlign: "right" })
              ? "right"
              : editor.isActive({ textAlign: "justify" })
                ? "justify"
                : "left"
        }
        onChange={(e) =>
          editor
            .chain()
            .focus()
            .setTextAlign(e.target.value as "left" | "center" | "right" | "justify")
            .run()
        }
      >
        <option value="left">⯇ 왼쪽</option>
        <option value="center">≡ 가운데</option>
        <option value="right">⯈ 오른쪽</option>
        <option value="justify">☰ 양쪽</option>
      </select>

      <Divider />

      <ToolbarButton
        title="글머리 목록"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </ToolbarButton>
      <ToolbarButton
        title="번호 목록"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarButton>
      <ToolbarButton
        title="인용"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ❝
      </ToolbarButton>
      <ToolbarButton
        title="코드 블록"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        {"{}"}
      </ToolbarButton>
      <ToolbarButton
        title="구분선"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        ―
      </ToolbarButton>

      <Divider />

      <ToolbarButton title="링크" active={editor.isActive("link")} onClick={addLink}>
        🔗
      </ToolbarButton>
      <ToolbarButton title="이미지 업로드" onClick={handleImagePick}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </ToolbarButton>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />

      <Divider />

      <ToolbarButton title="HTML 붙여넣기" onClick={() => setHtmlModalOpen(true)}>
        <span className="text-[10px] font-bold tracking-tight">HTML</span>
      </ToolbarButton>

      <HtmlPasteModal
        open={htmlModalOpen}
        onClose={() => setHtmlModalOpen(false)}
        onConfirm={insertHtml}
      />

      <ToolbarButton title="표 삽입 (3x3)" onClick={insertTable}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="3" x2="9" y2="21" />
          <line x1="15" y1="3" x2="15" y2="21" />
        </svg>
      </ToolbarButton>

      

      <Divider />

      <ToolbarButton
        title="실행 취소 (Ctrl+Z)"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↶
      </ToolbarButton>
      <ToolbarButton
        title="다시 실행 (Ctrl+Y)"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↷
      </ToolbarButton>
      <ToolbarButton
        title="서식 지우기"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      >
        ⌫
      </ToolbarButton>
    </div>
  );
}

function TableContextMenu({ editor }: { editor: Editor }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const dom = editor.view.dom;

    const onContextMenu = (e: Event) => {
      const event = e as MouseEvent;
      const coords = editor.view.posAtCoords({
        left: event.clientX,
        top: event.clientY,
      });
      if (!coords) return;

      const $pos = editor.state.doc.resolve(coords.pos);
      let inTable = false;
      for (let d = $pos.depth; d >= 0; d--) {
        if ($pos.node(d).type.name === "table") {
          inTable = true;
          break;
        }
      }
      if (!inTable) return;

      event.preventDefault();
      editor.chain().focus().setTextSelection(coords.pos).run();
      setPos({ x: event.clientX, y: event.clientY });
    };

    const onClose = () => setPos(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPos(null);
    };

    dom.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("click", onClose);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("keydown", onKey);
    return () => {
      dom.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("click", onClose);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [editor]);

  if (!pos) return null;

  const item = (label: string, action: () => void, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        action();
        setPos(null);
      }}
      className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed z-50 min-w-[180px] bg-white border border-slate-200 rounded-lg shadow-lg py-1"
      style={{ left: pos.x, top: pos.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {item(
        "↑ 위에 행 추가",
        () => editor.chain().focus().addRowBefore().run(),
        !editor.can().addRowBefore(),
      )}
      {item(
        "↓ 아래에 행 추가",
        () => editor.chain().focus().addRowAfter().run(),
        !editor.can().addRowAfter(),
      )}
      {item(
        "← 왼쪽에 열 추가",
        () => editor.chain().focus().addColumnBefore().run(),
        !editor.can().addColumnBefore(),
      )}
      {item(
        "→ 오른쪽에 열 추가",
        () => editor.chain().focus().addColumnAfter().run(),
        !editor.can().addColumnAfter(),
      )}
      <div className="h-px bg-slate-200 my-1" />
      {item(
        "행(가로줄) 삭제",
        () => editor.chain().focus().deleteRow().run(),
        !editor.can().deleteRow(),
      )}
      {item(
        "열(세로줄) 삭제",
        () => editor.chain().focus().deleteColumn().run(),
        !editor.can().deleteColumn(),
      )}
      <div className="h-px bg-slate-200 my-1" />
      {item(
        "표 삭제",
        () => editor.chain().focus().deleteTable().run(),
        !editor.can().deleteTable(),
      )}
    </div>
  );
}

export default function TibTapEditor({ onChange }: { onChange?: (html: string) => void } = {}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Image.configure({ inline: false, allowBase64: true }),
      TableKit.configure({ table: { resizable: true } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder: "내용을 입력하세요..." }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      LinkPreviewExtension,
    ],
    content: "",
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose-editor min-h-[500px] px-5 py-4 focus:outline-none leading-relaxed",
      },
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData("text/plain")?.trim();
        if (!text || text.includes(" ") || text.includes("\n")) return false;
        try { new URL(text); } catch { return false; }

        const node = view.state.schema.nodes.linkPreview?.create({ url: text });
        if (!node) return false;
        view.dispatch(view.state.tr.replaceSelectionWith(node));
        return true;
      },
    },
  });

  if (!editor) {
    return (
      <div className="h-[600px] border border-slate-200 rounded-xl flex items-center justify-center text-slate-400">
        에디터 로딩 중...
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <TableContextMenu editor={editor} />
    </div>
  );
}
