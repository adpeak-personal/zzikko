import type { Metadata } from 'next';
import Link from 'next/link';
import { apiGet } from '@/lib/api.server';
import type { SiseReport } from '@/lib/types';

/**
 * 시세 리포트 목록.
 *
 * 사이드바·헤더 메뉴에 **일부러 걸지 않는다.** 회원이 보는 글이 아니라
 * 검색으로 들어오는 글이다. 다만 아무 데서도 링크되지 않으면(orphan page)
 * 구글이 "사이트가 스스로 안 중요하다고 말하는 페이지"로 보기 때문에
 * 이 목록 하나는 둬서 크롤러가 타고 들어갈 길을 만든다.
 */
export const metadata: Metadata = {
  title: '지역별 휴대폰 성지 시세',
  description: '지역별 휴대폰 성지 시세표와 지난주 대비 변동을 정리합니다. 기종별 할부원금과 페이백을 한눈에 비교하세요.',
};

export const revalidate = 600;

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${year}년 ${Number(month)}월 ${Number(day)}일`;
}

export default async function SiseListPage() {
  let items: SiseReport[] = [];
  try {
    ({ items } = await apiGet<{ items: SiseReport[] }>('/sise'));
  } catch {
    items = [];
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="border-b border-gray-200 pb-5">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">지역별 휴대폰 성지 시세</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
          지역마다 올라온 시세표를 정리하고, 지난 기록과 견줘 무엇이 싸졌는지 적어 둡니다.
          <br className="hidden sm:block" /> 숫자는 올라온 시세표를 그대로 옮긴 것이며, 조건은 매장마다 다를 수 있습니다.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="py-20 text-center text-sm text-gray-400">아직 올라온 시세 기록이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((report) => {
            const cheaper = report.changes.filter((change) => change.delta < 0).length;
            const pricier = report.changes.filter((change) => change.delta > 0).length;

            return (
              <li key={report.id}>
                <Link href={`/sise/${report.slug}`} className="block py-5 hover:bg-gray-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-zz-50 px-1.5 py-0.5 text-[11px] font-semibold text-zz-700">
                      {report.sheet.region}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(report.sheet.datedOn)} 기준</span>
                  </div>

                  <h2 className="mt-1.5 text-[17px] font-bold leading-snug text-gray-900">{report.title}</h2>

                  {report.summary && (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-600">{report.summary}</p>
                  )}

                  {report.changes.length > 0 && (
                    <p className="mt-2 text-xs text-gray-500">
                      지난 기록 대비 <b className="text-zz-600">{cheaper}곳 좋아짐</b>
                      {pricier > 0 && <> · {pricier}곳 나빠짐</>}
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
