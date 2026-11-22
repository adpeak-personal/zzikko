import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { apiGetOrNull } from '@/lib/api.server';
import { SITE_URL, articleOg, iso } from '@/lib/seo';
import { SiseTable } from '@/components/sise/SiseTable';
import type { SiseReport } from '@/lib/types';
import { cn } from '@/lib/utils';

export const revalidate = 600;

const get = (slug: string) => apiGetOrNull<SiseReport>(`/sise/${encodeURIComponent(slug)}`);

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const report = await get(slug);
  if (!report) return { title: '시세 기록' };

  return {
    title: report.title,
    description: report.summary,
    alternates: { canonical: `${SITE_URL}/sise/${report.slug}` },
    openGraph: articleOg({
      title: report.title,
      description: report.summary,
      publishedTime: report.publishedAt,
      modifiedTime: report.updatedAt,
      image: report.sheet.imageUrl,
    }),
  };
}

/** 음수는 페이백이라 "얼마를 돌려받는다"로 읽힌다 */
const money = (price: number) => (price < 0 ? `${Math.abs(price)}만원 페이백` : `${price}만원`);

export default async function SiseReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const report = await get(slug);
  if (!report) notFound();

  const { sheet, sections, changes } = report;

  // 구조화 데이터 — AI 검색과 구글이 표 내용을 그대로 인용할 수 있게
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: report.title,
    description: report.summary,
    datePublished: iso(report.publishedAt),
    dateModified: iso(report.updatedAt),
    author: { '@type': 'Organization', name: '찍고' },
    publisher: { '@type': 'Organization', name: '찍고', url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/sise/${report.slug}`,
    about: `${sheet.region} 휴대폰 성지 시세`,
  };

  return (
    <article className="mx-auto max-w-3xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="border-b border-gray-200 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-zz-50 px-1.5 py-0.5 text-[11px] font-semibold text-zz-700">{sheet.region}</span>
          <span className="text-xs text-gray-400">{formatDate(sheet.datedOn)} 기준</span>
          {report.comparedTo && (
            <span className="text-xs text-gray-400">· {formatDate(report.comparedTo)} 기록과 비교</span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-extrabold leading-snug tracking-tight text-gray-900">{report.title}</h1>
        {report.summary && <p className="mt-2 text-[15px] leading-relaxed text-gray-600">{report.summary}</p>}
      </header>

      {sections.lead && (
        <p className="mt-6 whitespace-pre-line text-[16px] leading-[1.9] text-gray-800">{sections.lead}</p>
      )}

      {sheet.note && (
        <p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">{sheet.note}</p>
      )}

      <section className="mt-7">
        <h2 className="mb-3 text-lg font-bold text-gray-900">
          {formatDate(sheet.datedOn)} {sheet.region} 시세표
        </h2>
        <SiseTable rows={sheet.rows} />
      </section>

      {sections.blocks.map((block, index) => (
        <section key={index} className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-gray-900">{block.heading}</h2>
          {/* 글쓴이가 줄바꿈 두 번으로 문단을 나눈다 */}
          <div className="space-y-4">
            {block.body.split(/\n{2,}/).map((paragraph, line) => (
              <p key={line} className="whitespace-pre-line text-[16px] leading-[1.9] text-gray-800">
                {paragraph}
              </p>
            ))}
          </div>
        </section>
      ))}

      {changes.length > 0 && report.comparedTo && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-gray-900">{formatDate(report.comparedTo)} 대비 변동</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-[11px] text-gray-500">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">기종</th>
                  <th className="px-2 py-2 font-semibold">조건</th>
                  <th className="px-2 py-2 text-right font-semibold">이전</th>
                  <th className="px-2 py-2 text-right font-semibold">이번</th>
                  <th className="px-3 py-2 text-right font-semibold">변동</th>
                </tr>
              </thead>
              <tbody>
                {changes.slice(0, 20).map((change, index) => {
                  const better = change.delta < 0;
                  return (
                    <tr key={index} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2.5 font-semibold text-gray-900">{change.model}</td>
                      <td className="px-2 py-2.5 text-center text-xs text-gray-500">
                        {change.carrier} {change.joinType === '번호이동' ? '번이' : '기변'}
                      </td>
                      <td className="px-2 py-2.5 text-right text-xs text-gray-400">{money(change.before)}</td>
                      <td className="px-2 py-2.5 text-right text-gray-900">{money(change.after)}</td>
                      <td className={cn('px-3 py-2.5 text-right font-bold', better ? 'text-zz-600' : 'text-gray-500')}>
                        <span className="inline-flex items-center gap-0.5">
                          {better ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                          {Math.abs(change.delta)}만원
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-400">변동 칸의 화살표는 손님 기준입니다 — 아래쪽이 유리해진 것입니다.</p>
        </section>
      )}

      {sections.closing && (
        <section className="mt-8 rounded-xl bg-gray-50 px-5 py-4">
          <p className="whitespace-pre-line text-[15px] leading-[1.9] text-gray-700">{sections.closing}</p>
        </section>
      )}

      {/*
        글 맨 아래 안내. AI 가 쓴 문장이 아니라 코드가 그린다 —
        주소를 모델에게 맡기면 없는 링크를 지어낸다.
      */}
      <section className="mt-10 rounded-2xl border border-zz-200 bg-zz-50 px-5 py-5">
        <h2 className="text-base font-bold text-gray-900">{sheet.region} 성지는 어디서 보나요?</h2>
        <p className="mt-2 text-[15px] leading-[1.9] text-gray-700">
          지역별 매장이 올리는 그날의 가입 조건은 찍고 <b>성지 시세표</b> 게시판에 모여 있습니다. 같은 기종이라도 매장마다
          조건이 달라서, 여러 곳을 나란히 놓고 보는 편이 빠릅니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/board/deals"
            className="rounded-lg bg-zz-600 px-4 py-2 text-sm font-semibold text-white hover:bg-zz-700"
          >
            성지 시세표 보러가기
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-zz-300 bg-white px-4 py-2 text-sm font-semibold text-zz-700 hover:bg-white/60"
          >
            찍고 홈
          </Link>
        </div>
      </section>

      <footer className="mt-8 border-t border-gray-200 pt-5 text-xs leading-relaxed text-gray-400">
        <p>
          이 글의 숫자는 올라온 시세표를 옮긴 것으로, 재고·조건·시점에 따라 달라질 수 있습니다. 실제 가입 조건은 매장에
          확인하세요.
        </p>
        <Link href="/sise" className="mt-3 inline-block font-semibold text-zz-600 hover:underline">
          다른 지역 시세 보기 →
        </Link>
      </footer>
    </article>
  );
}
