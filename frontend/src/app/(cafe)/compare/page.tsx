import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGetPublic } from '@/lib/api.server';
import type { PhoneSpec } from '@/lib/types';
import { formatNumber } from '@/lib/utils';

/**
 * 기종 비교 목록.
 *
 * 시세 리포트와 같은 이유로 둔다 — 개별 비교 페이지가 아무 데서도 링크되지 않으면
 * 구글이 "사이트가 스스로 안 중요하다고 말하는 페이지" 로 본다.
 */
export const metadata: Metadata = {
  title: '기종 비교',
  description: '갤럭시와 아이폰을 기종별로 나란히 비교합니다. 화면·배터리·카메라·출고가를 항목별로 확인하세요.',
};

export const revalidate = 3600;

interface Pair {
  slug: string;
  reason: '타사 경쟁' | '세대 비교' | '등급 비교';
  a: PhoneSpec;
  b: PhoneSpec;
}

const ORDER: Pair['reason'][] = ['타사 경쟁', '세대 비교', '등급 비교'];

const BLURB: Record<Pair['reason'], string> = {
  '타사 경쟁': '같은 시기, 비슷한 값의 갤럭시와 아이폰',
  '세대 비교': '바꿀 만한지 — 앞 세대와 이번 세대',
  '등급 비교': '한 급 위로 갈 값어치가 있는지',
};

export default async function CompareListPage() {
  // 공개 목록이라 쿠키가 필요 없다 — 읽으면 정적 생성이 막힌다
  const data = await apiGetPublic<{ items: Pair[] }>('/compare');
  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">기종 비교</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
          실제로 같이 놓고 고민하는 조합만 골라 정리했습니다. 사양은 제조사 공개 자료 기준입니다.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="py-20 text-center text-sm text-gray-400">
          비교할 기종이 아직 모자랍니다. 기종 사양을 더 등록하면 자동으로 생깁니다.
        </p>
      ) : (
        ORDER.filter((reason) => items.some((item) => item.reason === reason)).map((reason) => (
          <section key={reason} className="mt-7">
            <h2 className="text-lg font-bold text-gray-900">{reason}</h2>
            <p className="mt-0.5 text-sm text-gray-500">{BLURB[reason]}</p>

            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {items
                .filter((item) => item.reason === reason)
                .map((item) => (
                  <li key={item.slug}>
                    <Link
                      href={`/compare/${item.slug}`}
                      className="block rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-zz-400"
                    >
                      <p className="font-bold leading-snug text-gray-900">
                        {item.a.name} <span className="text-gray-400">vs</span> {item.b.name}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatNumber(item.a.retailPrice)}원 · {formatNumber(item.b.retailPrice)}원
                      </p>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
