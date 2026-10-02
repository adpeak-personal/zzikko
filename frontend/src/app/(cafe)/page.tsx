import Link from 'next/link';
import { ArrowRight, Flame, Megaphone, Newspaper, PenSquare, ShoppingBag, Tags } from 'lucide-react';
import { apiGet } from '@/lib/api.server';
import { getBoards, getDeals, getLowestDeal, getPopular, getPosts, getShops } from '@/lib/data';
import type { NewsArticle } from '@/lib/types';
import { CarrierTag, Card, SectionHeader, Tag, Thumb } from '@/components/ui';
import { formatPrice, formatRelative, thumbTone } from '@/lib/utils';

const QUICK_LINKS = [
  { href: '/board/deals', label: '성지 시세표', desc: '지역별 오늘의 가입 조건', icon: Tags },
  { href: '/board/news', label: 'IT 소식', desc: '신제품·통신사 소식', icon: Newspaper },
  { href: '/write', label: '글쓰기', desc: '궁금한 건 물어보세요', icon: PenSquare },
];

/** 홈에서 최신글을 보여줄 게시판 */
const HOME_BOARDS = ['qna', 'review', 'internet', 'free'];

export default async function HomePage() {
  const [boards, notices, deals, popular, market, lowest, shops, news] = await Promise.all([
    getBoards(),
    getPosts({ size: 1 }).then((result) => result.notices),
    getDeals(5),
    getPopular(8),
    getPosts({ boardSlug: 'market', size: 4 }).then((result) => result.items),
    getLowestDeal(),
    getShops(),
    apiGet<{ items: NewsArticle[] }>('/news').then((result) => result.items.slice(0, 3)),
  ]);

  const boardLists = await Promise.all(
    HOME_BOARDS.map(async (slug) => ({
      board: boards.find((item) => item.slug === slug),
      items: (await getPosts({ boardSlug: slug, size: 5 })).items,
    })),
  );

  const shopName = (id: number) => shops.find((shop) => shop.id === id)?.name;

  return (
    <div className="space-y-5">
      {/* 큰 배너 */}
      <section className="overflow-hidden rounded-2xl bg-linear-to-br from-zz-500 to-zz-700 px-7 py-8 text-white sm:px-10 sm:py-10">
        <Tag tone="dark">오늘의 최저</Tag>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-0.04em] sm:text-4xl">
          성지 시세부터 솔직한 후기까지,
          <br />
          이웃에게 <span className="text-zz-100">묻고 찍고.</span>
        </h1>
        {lowest?.deal && (
          <p className="mt-4 text-[15px] text-zz-50">
            지금 가장 저렴한 조건은 <strong className="font-bold text-white">{lowest.deal.model}</strong> ·{' '}
            <strong className="font-bold text-white">{formatPrice(lowest.deal.principal)}</strong> 입니다.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/board/deals" className="rounded-xl bg-white px-5 py-3 font-bold text-zz-700 hover:bg-zz-50">
            성지 시세표 보기
          </Link>
          <Link href="/board/qna" className="rounded-xl bg-white/15 px-5 py-3 font-bold text-white hover:bg-white/25">
            질문·답변
          </Link>
        </div>
      </section>

      {/* 바로가기 */}
      <section className="grid gap-3 sm:grid-cols-3">
        {QUICK_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 hover:border-zz-300"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zz-50 text-zz-600">
              <item.icon size={20} />
            </span>
            <span className="min-w-0">
              <span className="block font-bold text-gray-900">{item.label}</span>
              <span className="block truncate text-xs text-gray-400">{item.desc}</span>
            </span>
          </Link>
        ))}
      </section>

      {/* 공지 */}
      {notices.length > 0 && (
        <Card className="divide-y divide-gray-100">
          {notices.map((post) => (
            <Link key={post.id} href={`/board/${post.boardSlug}/${post.id}`} className="flex items-center gap-2.5 px-5 py-3 hover:bg-gray-50">
              <Megaphone size={15} className="shrink-0 text-zz-500" />
              <Tag tone="zz">공지</Tag>
              <span className="line-clamp-1 flex-1 text-[15px] text-gray-800">{post.title}</span>
              <span className="hidden shrink-0 text-xs text-gray-400 sm:block">{formatRelative(post.createdAt)}</span>
            </Link>
          ))}
        </Card>
      )}

      {/* 방금 올라온 시세 */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-1.5">
              <Tags size={17} className="text-zz-500" /> 방금 올라온 시세
            </span>
          }
          sub="판매자가 직접 등록한 가입 조건"
          href="/board/deals"
        />
        <ul className="divide-y divide-gray-100">
          {deals.map((post) => {
            const deal = post.deal!;
            return (
              <li key={post.id}>
                <Link href={`/board/${post.boardSlug}/${post.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50">
                  <CarrierTag carrier={deal.carrier} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-gray-900">
                      {deal.model} <span className="text-xs font-normal text-gray-400">{deal.storage}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {post.category} · {deal.joinType} · {shopName(deal.shopId)} · {formatRelative(post.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-lg font-extrabold tracking-tight text-zz-600">{formatPrice(deal.principal)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* 인기글 */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-1.5">
              <Flame size={17} className="text-zz-500" /> 실시간 인기글
            </span>
          }
          sub="조회 · 좋아요 기준"
          href="/board/all"
        />
        <ol className="grid sm:grid-cols-2">
          {popular.map((post, index) => (
            <li key={post.id} className="border-b border-gray-100 sm:odd:border-r">
              <Link href={`/board/${post.boardSlug}/${post.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50">
                <span className={`w-4 shrink-0 text-center font-extrabold ${index < 3 ? 'text-zz-500' : 'text-gray-300'}`}>{index + 1}</span>
                <span className="line-clamp-1 flex-1 text-[15px] text-gray-800">{post.title}</span>
                {post.commentCount > 0 && <span className="shrink-0 text-xs font-bold text-zz-500">[{post.commentCount}]</span>}
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      {/* IT 소식 */}
      {news.length > 0 && (
        <Card>
          <SectionHeader
            title={
              <span className="flex items-center gap-1.5">
                <Newspaper size={17} className="text-zz-500" /> IT 소식
              </span>
            }
            href="/board/news"
          />
          <ul className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            {news.map((article) => (
              <li key={article.id}>
                <Link href={`/board/news/${article.id}`} className="group block">
                  <Thumb tone={article.thumb} className="aspect-16/9 rounded-xl" />
                  <p className="mt-2 line-clamp-2 text-sm font-semibold text-gray-800 group-hover:underline">{article.title}</p>
                  <p className="mt-0.5 truncate text-xs text-gray-400">{article.date}</p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 게시판별 최신글 */}
      <section className="grid gap-4 sm:grid-cols-2">
        {boardLists.map(({ board, items }) =>
          board ? (
            <Card key={board.slug}>
              <SectionHeader title={board.name} href={`/board/${board.slug}`} />
              <ul className="px-5 py-3">
                {items.map((post) => (
                  <li key={post.id}>
                    <Link href={`/board/${board.slug}/${post.id}`} className="flex items-center gap-2 py-1.5 hover:underline">
                      <span className="line-clamp-1 flex-1 text-[15px] text-gray-700">{post.title}</span>
                      <span className="shrink-0 text-xs text-gray-400">{formatRelative(post.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null,
        )}
      </section>

      {/* 중고장터 */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-1.5">
              <ShoppingBag size={17} className="text-zz-500" /> 중고장터
            </span>
          }
          sub="공기계 · 액세서리 직거래"
          href="/board/market"
        />
        <ul className="grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
          {market.map((post) => (
            <li key={post.id}>
              <Link href={`/board/market/${post.id}`} className="group block">
                {post.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 업로드 경로는 rewrite/GCS 라 next/image 미적용
                  <img src={post.thumbUrl} alt="" className="aspect-square w-full rounded-xl object-cover" />
                ) : (
                  <Thumb tone={thumbTone(post) ?? 'zz'} className="aspect-square rounded-xl" />
                )}
                <p className="mt-2 line-clamp-1 text-sm font-semibold text-gray-800 group-hover:underline">{post.title}</p>
                <p className="mt-0.5 truncate text-xs text-gray-400">{post.author?.nickname}</p>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      {/* 판매자 참여 */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gray-900 px-7 py-6 text-white">
        <div>
          <p className="text-lg font-bold">판매자이신가요?</p>
          <p className="mt-1 text-sm text-gray-300">인증을 받으면 성지 시세표에 우리 매장 조건을 올릴 수 있어요.</p>
        </div>
        <Link href="/guide#seller" className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-3 font-bold text-gray-900 hover:bg-gray-100">
          판매자 참여 안내 <ArrowRight size={16} />
        </Link>
      </section>
    </div>
  );
}
