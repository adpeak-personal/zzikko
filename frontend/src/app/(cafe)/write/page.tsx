import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getBoardGroups, getCurrentUser } from '@/lib/data';
import { PageTitle } from '@/components/ui';
import { PostForm } from './PostForm';
import { PhotoForm } from './PhotoForm';

export const metadata: Metadata = { title: '글쓰기' };

export default async function WritePage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login?next=/write');

  const { board: boardSlug = 'qna' } = await searchParams;
  const boardGroups = await getBoardGroups();

  // 어드민이 관리하는 게시판(IT 소식·스펙 비교)은 글쓰기 대상이 아니고,
  // 판매자 전용 게시판은 판매자·운영진에게만 보여준다
  const writableGroups = boardGroups
    .map((group) => ({
      ...group,
      boards: group.boards.filter(
        (board) =>
          board.type !== 'news' &&
          board.type !== 'spec' &&
          (!board.sellerOnly || me.role === '판매자' || me.role === '운영진'),
      ),
    }))
    .filter((group) => group.boards.length > 0);

  const writable = writableGroups.flatMap((group) => group.boards);
  const board = writable.find((item) => item.slug === boardSlug) ?? writable[0];
  if (!board) notFound();

  return (
    <div>
      <PageTitle
        title="글쓰기"
        desc={
          board.writeMode === 'photo'
            ? '사진을 올리고 짧은 설명을 남겨주세요.'
            : '궁금한 건 물어보고, 알게 된 정보는 나눠주세요.'
        }
      />
      {/* 게시판 설정(writeMode)에 따라 작성 화면이 갈린다 — 저장 형식은 같다 */}
      {board.writeMode === 'photo' ? (
        <PhotoForm boardGroups={writableGroups} board={board} />
      ) : (
        <PostForm boardGroups={writableGroups} board={board} />
      )}
    </div>
  );
}
