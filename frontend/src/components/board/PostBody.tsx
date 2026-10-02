import type { Post } from '@/lib/types';
import { EditorContentView } from './EditorContentView';

/**
 * 게시글 본문.
 *
 * 저장 정본은 ProseMirror JSON 이라 HTML 을 주고받지 않는다 —
 * 본문에 스크립트가 섞여 들어올 경로가 없다. 화면에서 JSON 을 그려준다.
 */
export function PostBody({ post }: { post: Post }) {
  if (post.contentJson) return <EditorContentView doc={post.contentJson} />;

  return <div className="whitespace-pre-line text-[17px] leading-[1.9] text-gray-800">{post.content}</div>;
}
