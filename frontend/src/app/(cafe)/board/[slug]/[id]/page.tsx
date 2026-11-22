import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Eye, List, MessageCircle, Store } from 'lucide-react';
import { apiGet, apiGetOrNull } from '@/lib/api.server';
import { getBoard, getComments, getCurrentUser, getPost, getPosts, getShops } from '@/lib/data';
import type { Chipset, DealInfo, NewsArticle, PhoneSpec } from '@/lib/types';
import { PostBody } from '@/components/board/PostBody';
import { CommentSection } from '@/components/board/CommentSection';
import { LikeButton } from '@/components/board/LikeButton';
import { PostActions, ScrapButton } from '@/components/board/PostActions';
import { NewsDetail } from '@/components/news/NewsDetail';
import { SpecDetail } from '@/components/specs/SpecDetail';
import { Avatar, Card, CarrierTag, LevelBadge, SellerBadge, Tag } from '@/components/ui';
import { formatDate, formatNumber, formatPrice, formatRelative } from '@/lib/utils';

type Params = { params: Promise<{ slug: string; id: string }> };

const SITE = process.env.SITE_URL ?? 'https://zzikko.co.kr';

const url = (slug: string, id: number | string) => `${SITE}/board/${slug}/${id}`;

/**
 * 기사 구조화 데이터.
 *
 * 시세 글에는 진작 넣어 뒀는데 기사만 빠져 있었다. AI 검색이 인용하려면
 * 누가 언제 쓴 글인지가 기계가 읽을 수 있는 자리에 있어야 한다.
 *
 * 출처를 밝히는 건 GSMArena 이용 조건이기도 하다 — 화면 하단뿐 아니라
 * `citation` 으로도 남긴다.
 */
function newsJsonLd(article: NewsArticle, slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary,
    datePublished: article.date,
    author: { '@type': 'Organization', name: article.author },
    publisher: { '@type': 'Organization', name: '찍고', url: SITE },
    mainEntityOfPage: url(slug, article.id),
    articleSection: article.category,
    ...(article.thumbUrl ? { image: [article.thumbUrl] } : {}),
    ...(article.sourceUrl ? { citation: article.sourceUrl } : {}),
  };
}

/**
 * 기종 구조화 데이터.
 *
 * ⚠️ `offers` 를 넣지 않는다 — 우리가 파는 물건이 아니다. 출고가는 제조사 가격이지
 * 우리 판매가가 아니라서, offers 로 적으면 검색 결과에 없는 판매를 광고하는 셈이 된다.
 */
function specJsonLd(spec: PhoneSpec, slug: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: spec.name,
    brand: { '@type': 'Brand', name: spec.brand },
    description: [spec.display, spec.storage, spec.battery].filter(Boolean).join(' · '),
    releaseDate: spec.releaseDate,
    url: url(slug, spec.id),
    ...(spec.thumbUrl ? { image: [spec.thumbUrl] } : {}),
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug, id } = await params;
  const board = await getBoard(slug);

  if (board?.type === 'news') {
    const article = await apiGetOrNull<NewsArticle>(`/news/${id}`);
    if (!article) return { title: 'IT 소식' };
    return {
      title: article.title,
      description: article.summary,
      alternates: { canonical: url(slug, article.id) },
      openGraph: {
        title: article.title,
        description: article.summary,
        type: 'article',
        publishedTime: article.date,
        images: article.thumbUrl ? [article.thumbUrl] : undefined,
      },
      // 미발행은 운영진만 보는 초안이다 — 혹시 주소가 새어도 색인되지 않게
      ...(article.published ? {} : { robots: { index: false, follow: false } }),
    };
  }
  if (board?.type === 'spec') {
    const spec = await apiGetOrNull<PhoneSpec>(`/specs/${id}`);
    if (!spec) return { title: '스펙 비교' };
    const description = `${spec.name} 사양 — ${[spec.display, spec.storage, spec.battery].filter(Boolean).join(' · ')}`;
    return {
      title: spec.name,
      description,
      alternates: { canonical: url(slug, spec.id) },
      openGraph: {
        title: spec.name,
        description,
        type: 'article',
        images: spec.thumbUrl ? [spec.thumbUrl] : undefined,
      },
      ...(spec.published ? {} : { robots: { index: false, follow: false } }),
    };
  }

  const post = await getPost(Number(id));
  return post ? { title: post.title, description: post.content.slice(0, 120) } : { title: '글을 찾을 수 없습니다' };
}

export default async function PostPage({ params }: Params) {
  const { slug, id } = await params;
  const board = await getBoard(slug);

  // IT 소식·스펙 비교는 게시글이 아니라 어드민에서 관리하는 콘텐츠다
  if (board?.type === 'news') {
    const [article, all] = await Promise.all([
      apiGetOrNull<NewsArticle>(`/news/${id}`),
      apiGet<{ items: NewsArticle[] }>('/news'),
    ]);
    if (!article) notFound();
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(newsJsonLd(article, slug)) }}
        />
        <NewsDetail article={article} others={all.items.filter((item) => item.id !== article.id).slice(0, 4)} />
      </>
    );
  }

  if (board?.type === 'spec') {
    const [spec, all] = await Promise.all([
      apiGetOrNull<PhoneSpec>(`/specs/${id}`),
      apiGet<{ items: PhoneSpec[]; chipsets: Chipset[] }>('/specs'),
    ]);
    if (!spec) notFound();
    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(specJsonLd(spec, slug)) }}
        />
        <SpecDetail
          spec={spec}
          chipsets={all.chipsets}
          others={all.items.filter((item) => item.id !== spec.id).slice(0, 4)}
        />
      </>
    );
  }

  const post = await getPost(Number(id));
  if (!post || post.boardSlug !== slug) notFound();

  const [comments, me, shops, related] = await Promise.all([
    getComments(post.id),
    getCurrentUser(),
    post.deal ? getShops() : Promise.resolve([]),
    getPosts({ boardSlug: post.boardSlug, size: 6 }),
  ]);

  const shop = post.deal ? shops.find((item) => item.id === post.deal!.shopId) : undefined;
  const others = related.items.filter((item) => item.id !== post.id).slice(0, 5);
  const author = post.author;

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1 text-sm font-medium text-gray-400" aria-label="현재 위치">
        <Link href="/board/all" className="hover:text-gray-700">
          게시판
        </Link>
        <ChevronRight size={14} />
        <Link href={`/board/${post.boardSlug}`} className="hover:text-gray-700">
          {board?.name}
        </Link>
      </nav>

      <Card>
        <header className="border-b border-gray-100 px-6 py-6">
          <div className="flex flex-wrap items-center gap-2">
            {post.isNotice && <Tag tone="zz">공지</Tag>}
            {post.category && <Tag>{post.category}</Tag>}
            {post.region && <Tag>{post.region}</Tag>}
          </div>
          <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-tight text-gray-900">{post.title}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {author && <Avatar user={author} size={42} />}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-gray-900">{author?.nickname}</span>
                {author?.role === '판매자' ? (
                  <SellerBadge verified={shop?.verified ?? true} />
                ) : (
                  author && <LevelBadge level={author.level} />
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                <time dateTime={post.createdAt} title={formatDate(post.createdAt)}>
                  {formatRelative(post.createdAt)}
                </time>
                <span className="inline-flex items-center gap-1">
                  <Eye size={13} /> {formatNumber(post.views)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle size={13} /> {post.commentCount}
                </span>
              </div>
            </div>

            {/* 수정·삭제는 본인과 운영진만 — 서버도 다시 확인한다 */}
            {me && (me.id === post.authorId || me.role === '운영진') && (
              <PostActions postId={post.id} boardSlug={post.boardSlug} />
            )}
          </div>
        </header>

        {post.deal && <DealSpec deal={post.deal} />}

        <div className="px-6 py-7">
          <PostBody post={post} />
        </div>

        {shop && (
          <Link
            href={`/board/deals?q=${encodeURIComponent(shop.name)}`}
            className="mx-6 mb-6 flex items-center gap-2.5 rounded-xl bg-shop-50 px-4 py-4 text-shop-700 hover:bg-shop-50/70"
          >
            <Store size={18} />
            <span className="flex-1">
              <strong className="font-bold">{shop.name}</strong>이(가) 올린 다른 시세 보기
            </span>
            <ChevronRight size={16} />
          </Link>
        )}

        <div className="flex items-center justify-center gap-2 border-t border-gray-100 py-5">
          <LikeButton postId={post.id} likes={post.likes} canLike={Boolean(me)} initialLiked={post.liked ?? false} />
          <ScrapButton postId={post.id} initialScrapped={post.scrapped ?? false} canScrap={Boolean(me)} />
          <Link
            href={`/board/${post.boardSlug}`}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-2.5 font-bold text-gray-700 hover:border-gray-300"
          >
            <List size={16} /> 목록
          </Link>
        </div>
      </Card>

      <CommentSection postId={post.id} postAuthorId={post.authorId} comments={comments} me={me} />

      {others.length > 0 && (
        <Card>
          <h2 className="border-b border-gray-100 px-6 py-4 text-base font-bold text-gray-900">{board?.name}의 다른 글</h2>
          <ul className="px-6 py-3">
            {others.map((item) => (
              <li key={item.id}>
                <Link href={`/board/${item.boardSlug}/${item.id}`} className="flex items-center gap-2 py-2 hover:underline">
                  <span className="line-clamp-1 flex-1 text-[15px] text-gray-700">{item.title}</span>
                  <span className="shrink-0 text-xs text-gray-400">{formatRelative(item.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

/** 시세 글의 가입 조건 요약 */
function DealSpec({ deal }: { deal: DealInfo }) {
  const rows = [
    { label: '기종', value: `${deal.model} ${deal.storage}` },
    { label: '가입 유형', value: deal.joinType },
    { label: '요금제', value: `${deal.plan} · ${deal.planMonths}개월 유지` },
    { label: '부가서비스', value: deal.addons.length ? deal.addons.join(', ') : '없음' },
  ];

  return (
    <div className="mx-6 mt-6 overflow-hidden rounded-2xl border border-zz-200">
      <div className="flex items-center justify-between gap-3 bg-zz-50 px-5 py-4">
        <div className="flex items-center gap-2">
          <CarrierTag carrier={deal.carrier} />
          <span className="font-bold text-gray-900">가입 조건</span>
        </div>
        <div className="text-right">
          <span className="block text-xs text-gray-500">할부원금</span>
          <strong className="text-2xl font-extrabold tracking-tight text-zz-600">{formatPrice(deal.principal)}</strong>
        </div>
      </div>
      <dl className="divide-y divide-gray-100 bg-white">
        {rows.map((row) => (
          <div key={row.label} className="flex gap-4 px-5 py-3 text-sm">
            <dt className="w-24 shrink-0 font-semibold text-gray-500">{row.label}</dt>
            <dd className="text-gray-800">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="bg-gray-50 px-5 py-3 text-xs leading-relaxed text-gray-500">
        방문 전 매장에 다시 확인하세요. 요금제 유지 기간과 부가서비스 해지일을 꼭 메모해 두세요.
      </p>
    </div>
  );
}
