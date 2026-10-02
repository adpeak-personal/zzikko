import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PenSquare, Search } from 'lucide-react';
import { apiGet } from '@/lib/api.server';
import { getBoard, getBoards, getPosts, getShops } from '@/lib/data';
import type { Board, Chipset, NewsArticle, PhoneSpec } from '@/lib/types';
import { PostTable } from '@/components/board/PostTable';
import { DealTable } from '@/components/board/DealTable';
import { GalleryGrid } from '@/components/board/GalleryGrid';
import { Pagination } from '@/components/board/Pagination';
import { NewsBoard } from '@/components/news/NewsBoard';
import { SpecBoard } from '@/components/specs/SpecBoard';
import { EmptyState, FilterChip, Tag } from '@/components/ui';

/** 모든 게시판의 글을 모아 보는 가상 게시판 */
const ALL_BOARD: Board = {
  id: 0,
  slug: 'all',
  name: '전체글보기',
  description: '모든 게시판의 최신 글',
  type: 'list',
  writeMode: 'editor',
};

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string; category?: string; q?: string }> };

async function loadBoard(slug: string) {
  return slug === 'all' ? ALL_BOARD : await getBoard(slug);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const board = await loadBoard((await params).slug);
  return board ? { title: board.name, description: board.description } : { title: '게시판을 찾을 수 없습니다' };
}

export default async function BoardPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { page: pageParam, category, q } = await searchParams;
  const board = await loadBoard(slug);
  if (!board) notFound();

  const page = Number(pageParam) || 1;
  const size = board.type === 'gallery' ? 12 : 15;

  // 기사·기종은 게시글이 아니라서 글쓰기·말머리 칩·페이지 번호·검색을 쓰지 않는다
  const isContentBoard = board.type === 'news' || board.type === 'spec';

  const hrefWith = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    Object.entries({ category, q, ...next }).forEach(([key, value]) => value && search.set(key, value));
    const text = search.toString();
    return `/board/${slug}${text ? `?${text}` : ''}`;
  };

  // 게시판 종류에 따라 필요한 데이터만 불러온다
  const news = board.type === 'news' ? (await apiGet<{ items: NewsArticle[] }>('/news')).items : [];
  const specs =
    board.type === 'spec' ? await apiGet<{ items: PhoneSpec[]; chipsets: Chipset[] }>('/specs') : { items: [], chipsets: [] as Chipset[] };

  const result = isContentBoard
    ? { items: [], notices: [], total: 0 }
    : await getPosts({ boardSlug: slug === 'all' ? undefined : slug, category, q, page, size });

  const shops = board.type === 'deal' ? await getShops() : [];
  const boardNames =
    slug === 'all' ? Object.fromEntries((await getBoards()).map((item) => [item.slug, item.name])) : {};

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b-2 border-gray-900 pb-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{board.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{board.description}</p>
        </div>
        {!isContentBoard && (
          <Link
            href={`/write?board=${slug === 'all' ? 'free' : slug}`}
            className="flex items-center gap-1 rounded-lg bg-zz-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zz-700"
          >
            <PenSquare size={15} /> 글쓰기
          </Link>
        )}
      </div>

      {board.sellerOnly && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-shop-50 px-4 py-3 text-sm leading-relaxed text-shop-700">
          <Tag tone="shop">판매자 전용</Tag>
          인증된 판매자만 글을 쓸 수 있는 게시판입니다. 조건 문의는 댓글로 남겨주세요.
        </p>
      )}

      {board.categories && !isContentBoard && (
        <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto">
          <FilterChip href={hrefWith({ category: undefined, page: undefined })} active={!category}>
            전체
          </FilterChip>
          {board.categories.map((item) => (
            <FilterChip key={item} href={hrefWith({ category: item, page: undefined })} active={category === item}>
              {item}
            </FilterChip>
          ))}
        </div>
      )}

      {board.type === 'news' ? (
        <NewsBoard articles={news} />
      ) : board.type === 'spec' ? (
        <SpecBoard specs={specs.items} chipsets={specs.chipsets} />
      ) : board.type === 'deal' ? (
        <DealTable items={result.items} shops={shops} />
      ) : board.type === 'gallery' ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          {result.items.length > 0 ? <GalleryGrid items={result.items} /> : <EmptyState>등록된 게시글이 없습니다.</EmptyState>}
        </div>
      ) : (
        <PostTable items={result.items} notices={result.notices} showBoard={slug === 'all'} boardNames={boardNames} />
      )}

      {!isContentBoard && (
        <>
          <Pagination page={page} total={result.total} size={size} makeHref={(p) => hrefWith({ page: String(p) })} />

          <form className="mx-auto mt-5 flex max-w-md gap-2" action={`/board/${slug}`}>
            <input
              name="q"
              defaultValue={q}
              placeholder="게시판 내 검색"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-zz-400"
            />
            <button type="submit" className="rounded-lg bg-gray-800 px-3 text-white hover:bg-gray-900" aria-label="검색">
              <Search size={16} />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
