import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiGetPublic } from '@/lib/api.server';
import { SITE_URL, articleOg } from '@/lib/seo';
import { CompareTable } from '@/components/specs/CompareTable';
import { SPEC_ROWS, findChipset } from '@/components/specs/spec-rows';
import type { Chipset, PhoneSpec } from '@/lib/types';

/**
 * 기종 둘을 나란히 놓는 비교 페이지.
 *
 * 짝은 백엔드가 규칙으로 고른다(`lib/specs/pairs.ts`) — 가능한 조합을 전부 만들면
 * 아무도 찾지 않는 페이지가 수백 개 생기고, 구글이 대량 생성 콘텐츠로 본다.
 */
export const revalidate = 3600;


interface ComparePair {
  a: PhoneSpec;
  b: PhoneSpec;
  reason: string;
  chipsets: Chipset[];
}

/**
 * 주소 조각을 한 번만 인코딩한다.
 *
 * 기종 이름이 한글이라 주소가 인코딩되는데, **Next 는 params.slug 를 인코딩된 채로 준다.**
 * 거기에 encodeURIComponent 를 또 걸면 `%` 가 `%25` 가 돼 백엔드가 못 찾는다.
 * 그래서 먼저 풀고 다시 건다 (이미 풀린 값이어도 결과는 같다).
 */
function normalize(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    // 잘못 인코딩된 주소면 받은 그대로 쓴다
    return slug;
  }
}

/**
 * 쿠키를 읽지 않는다.
 *
 * 이 페이지는 로그인과 무관한 공개 페이지다. cookies() 를 부르면 정적 생성이 막히고,
 * generateStaticParams 로 미리 뽑아 둔 주소에서는 아예 못 읽어 404 가 된다.
 */
const get = (slug: string) => apiGetPublic<ComparePair>(`/compare/${encodeURIComponent(normalize(slug))}`);

/**
 * 색인할 주소를 미리 알려 준다.
 *
 * 여기는 요청 없이 빌드 때 돌기 때문에 쿠키를 읽는 apiGet 을 쓰면 터진다.
 */
export async function generateStaticParams() {
  const data = await apiGetPublic<{ items: { slug: string }[] }>('/compare');
  return (data?.items ?? []).map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const pair = await get(slug);
  if (!pair) return { title: '기종 비교' };

  const title = `${pair.a.name} vs ${pair.b.name} 비교`;
  const description = `${pair.a.name}와 ${pair.b.name}의 화면·배터리·카메라·출고가를 항목별로 비교합니다.`;

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/compare/${encodeURIComponent(normalize(slug))}` },
    openGraph: articleOg({ title, description }),
  };
}

export default async function ComparePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pair = await get(slug);
  if (!pair) notFound();

  const { a, b, chipsets } = pair;

  /** 두 기종이 갈리는 항목만 뽑아 글머리로 쓴다 */
  const differences = SPEC_ROWS.filter((row) => row.rule !== 'none' && row.value)
    .map((row) => {
      const va = row.value!(a, chipsets);
      const vb = row.value!(b, chipsets);
      if (!va || !vb || va === vb) return null;
      const better = row.rule === 'lower' ? (va < vb ? a : b) : va > vb ? a : b;
      return { label: row.label, a: row.text(a, chipsets), b: row.text(b, chipsets), better, neutral: row.rule === 'neutral' };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  /*
   * ⚠️ `offers` 를 넣지 않는다 — 우리가 파는 물건이 아니다.
   *
   * 출고가는 제조사 가격이지 우리 판매가가 아닌데, Offer 로 적으면 구글은
   * "이 페이지에서 155만원에 판다"로 읽는다. 기종 페이지도 같은 이유로 안 넣는다.
   * 출고가 자체는 화면의 비교표에 그대로 있다.
   */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${a.name} vs ${b.name} 비교`,
    itemListElement: [a, b].map((spec, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Product',
        name: spec.name,
        brand: { '@type': 'Brand', name: spec.brand },
        description: [spec.display, spec.storage, spec.battery].filter(Boolean).join(' · '),
        releaseDate: spec.releaseDate,
        ...(spec.thumbUrl ? { image: [spec.thumbUrl] } : {}),
      },
    })),
  };

  return (
    <div className="mx-auto max-w-4xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-gray-200 pb-5">
        <p className="text-sm font-semibold text-zz-600">{pair.reason}</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-snug tracking-tight text-gray-900">
          {a.name} vs {b.name}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
          출고가 · 칩셋 · 화면 · 배터리 · 카메라를 항목별로 견줬습니다. 표의 값은 제조사가 공개한 사양입니다.
        </p>
      </header>

      {differences.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-lg font-bold text-gray-900">뭐가 다른가요</h2>
          <ul className="space-y-2">
            {differences.slice(0, 6).map((item) => (
              <li key={item.label} className="flex gap-2.5 text-[15px] leading-relaxed text-gray-800">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-zz-500" />
                <span>
                  <b>{item.label}</b> — {a.name} {item.a} / {b.name} {item.b}
                  {!item.neutral && <span className="ml-1 text-zz-600">({item.better.name} 우세)</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <h2 className="mb-3 text-lg font-bold text-gray-900">전체 사양 비교</h2>
        <CompareTable specs={[a, b]} chipsets={chipsets} max={2} />
      </section>

      <footer className="mt-8 border-t border-gray-200 pt-5">
        <p className="text-xs leading-relaxed text-gray-400">
          사양은 제조사 공개 자료 기준이며, 출고가는 국내 기준입니다. 실제 구매가는 통신사·가입 조건에 따라
          크게 달라집니다 —{' '}
          <Link href="/sise" className="font-semibold text-zz-600 hover:underline">
            지역별 시세표
          </Link>
          에서 확인하세요.
        </p>
        <Link href="/compare" className="mt-3 inline-block text-sm font-semibold text-zz-600 hover:underline">
          다른 기종 비교 보기 →
        </Link>
      </footer>
    </div>
  );
}
