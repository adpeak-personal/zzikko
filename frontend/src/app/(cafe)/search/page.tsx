import type { Metadata } from 'next';
import { Search } from 'lucide-react';
import { getBoards, getPosts } from '@/lib/data';
import { PostTable } from '@/components/board/PostTable';
import { Pagination } from '@/components/board/Pagination';
import { PageTitle } from '@/components/ui';

export const metadata: Metadata = { title: '검색' };

const SIZE = 15;

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page: pageParam } = await searchParams;
  const keyword = q?.trim() ?? '';
  const page = Number(pageParam) || 1;

  const result = keyword ? await getPosts({ q: keyword, page, size: SIZE }) : { items: [], total: 0 };
  const boardNames = keyword ? Object.fromEntries((await getBoards()).map((board) => [board.slug, board.name])) : {};

  return (
    <div>
      <PageTitle title="검색" desc={keyword ? `‘${keyword}’ 검색 결과 ${result.total}건` : '기종, 지역, 매장 이름으로 찾아보세요.'} />

      <form action="/search" className="mb-5 flex gap-2" role="search">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-400 focus-within:border-zz-400">
          <Search size={18} />
          <span className="sr-only">검색어</span>
          <input
            name="q"
            defaultValue={keyword}
            placeholder="기종, 지역, 매장 검색"
            className="w-full bg-transparent text-[15px] text-gray-900 outline-none"
          />
        </label>
        <button type="submit" className="rounded-xl bg-gray-900 px-6 font-bold text-white hover:bg-black">
          검색
        </button>
      </form>

      {keyword ? (
        <>
          <PostTable items={result.items} showBoard boardNames={boardNames} />
          <Pagination page={page} total={result.total} size={SIZE} makeHref={(p) => `/search?q=${encodeURIComponent(keyword)}&page=${p}`} />
        </>
      ) : (
        <p className="rounded-2xl border border-gray-200 bg-white py-20 text-center text-sm text-gray-400">검색어를 입력해주세요.</p>
      )}
    </div>
  );
}
