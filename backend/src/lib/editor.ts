/**
 * 에디터 본문(ProseMirror JSON) 다루기.
 *
 * 저장 정본은 JSON 이다. 브라우저가 만든 HTML 을 그대로 받지 않기 때문에
 * `<script>` 같은 태그가 본문에 섞여 들어올 경로가 없다.
 * 서버는 목록 미리보기·검색에 쓸 평문만 뽑아 둔다.
 */

interface Node {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: Node[];
}

/** 블록이 바뀔 때 줄바꿈을 넣을 노드들 */
const BLOCK_TYPES = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'tableRow']);

/** 본문에서 평문만 뽑는다 (검색·목록 미리보기용) */
export function toPlainText(doc: unknown): string {
  const lines: string[] = [];
  let current = '';

  const walk = (node: Node) => {
    if (typeof node.text === 'string') current += node.text;
    node.content?.forEach(walk);
    if (node.type && BLOCK_TYPES.has(node.type)) {
      lines.push(current.trim());
      current = '';
    }
  };

  if (doc && typeof doc === 'object') walk(doc as Node);
  if (current.trim()) lines.push(current.trim());

  return lines.filter(Boolean).join('\n').slice(0, 20000);
}

/** 본문에 이미지가 들어 있는지 — 목록의 사진 아이콘·썸네일용 */
export function findFirstImage(doc: unknown): string | null {
  let found: string | null = null;

  const walk = (node: Node) => {
    if (found) return;
    if (node.type === 'image' && typeof node.attrs?.src === 'string') {
      found = node.attrs.src;
      return;
    }
    node.content?.forEach(walk);
  };

  if (doc && typeof doc === 'object') walk(doc as Node);
  return found;
}

/**
 * 본문에 쓰인 이미지 주소를 등장 순서대로 모은다.
 *
 * 글을 등록할 때 "이 글이 실제로 쓰는 이미지" 를 가려내는 데 쓴다.
 * 여기 없는 이미지는 올렸다가 지운 것이므로 청소 대상이 된다.
 */
export function collectImages(doc: unknown): string[] {
  const found: string[] = [];

  const walk = (node: Node) => {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') found.push(node.attrs.src);
    node.content?.forEach(walk);
  };

  if (doc && typeof doc === 'object') walk(doc as Node);
  return found;
}

/** 빈 본문인지 — 글자도 이미지도 없으면 비어 있는 것으로 본다 */
export function isEmptyDoc(doc: unknown): boolean {
  return toPlainText(doc).length === 0 && findFirstImage(doc) === null;
}

/** 평문을 ProseMirror JSON 으로 — 시드 데이터나 옛 글을 옮길 때 쓴다 */
export function fromPlainText(text: string) {
  return {
    type: 'doc',
    content: text.split('\n').map((line) =>
      line.trim() ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' },
    ),
  };
}
