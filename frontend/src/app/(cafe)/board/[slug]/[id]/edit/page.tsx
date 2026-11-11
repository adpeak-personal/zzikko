import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getBoardGroups, getCurrentUser, getPostForEdit } from '@/lib/data';
import { PageTitle } from '@/components/ui';
import { PostForm } from '@/app/(cafe)/write/PostForm';
import { PhotoForm } from '@/app/(cafe)/write/PhotoForm';

export const metadata: Metadata = { title: '글 수정' };

export default async function EditPostPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;

  const me = await getCurrentUser();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/board/${slug}/${id}/edit`)}`);

  // 권한 판단은 서버가 한다 — 남의 글이면 여기서 null 이 온다
  const post = await getPostForEdit(Number(id));
  if (!post) notFound();

  const boardGroups = await getBoardGroups();
  const board = boardGroups.flatMap((group) => group.boards).find((item) => item.slug === post.boardSlug);
  if (!board) notFound();

  return (
    <div>
      <PageTitle title="글 수정" desc={`${board.name} 게시판`} />
      {/* 작성 때와 같은 폼을 쓴다 — 작성 방식은 글이 속한 게시판 설정을 따른다 */}
      {board.writeMode === 'photo' ? (
        <PhotoForm boardGroups={boardGroups} board={board} editing={post} />
      ) : (
        <PostForm boardGroups={boardGroups} board={board} editing={post} />
      )}
    </div>
  );
}
