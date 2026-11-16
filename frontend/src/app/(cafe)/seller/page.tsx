import type { Metadata } from 'next';
import { Coins, MessageSquareText, Search, Upload } from 'lucide-react';
import { SellerApplyForm } from './SellerApplyForm';

export const metadata: Metadata = {
  title: '판매자 입점 신청',
  description: '성지 시세표에 우리 매장 조건을 무료로 올리세요. 조건만 보내주시면 찍고가 대신 올려드립니다.',
};

const BENEFITS = [
  {
    icon: Coins,
    title: '수수료 0원',
    body: '입점비도 광고비도 없습니다. 초기 입점 매장은 앞으로도 계속 무료입니다.',
  },
  {
    icon: Upload,
    title: '올리는 건 저희가',
    body: '매일 시세표 만들 필요 없습니다. 쓰시던 그대로 카톡으로 보내주시면 저희가 올려드립니다.',
  },
  {
    icon: Search,
    title: '지역으로 찾는 손님',
    body: '시세표는 지역별로 나뉩니다. 우리 동네에서 찾는 사람에게 바로 걸립니다.',
  },
  {
    icon: MessageSquareText,
    title: '문의는 매장으로 바로',
    body: '중간에서 가로채지 않습니다. 댓글과 연락처로 손님이 직접 연락합니다.',
  },
];

const FAQ = [
  {
    q: '정말 공짜인가요?',
    a: '네. 지금은 시세표를 채우는 게 먼저라 받을 생각이 없습니다. 나중에 유료 상품이 생기더라도 초기 입점 매장은 계속 무료로 씁니다.',
  },
  {
    q: '조건이 경쟁 매장에 다 보이는 거 아닌가요?',
    a: '시세표 성격상 공개가 기본이지만, 원하시면 할부원금을 가리고 "문의" 로만 올려드립니다. 어느 선까지 공개할지는 매장에서 정하시면 됩니다.',
  },
  {
    q: '지금 회원이 얼마나 되나요?',
    a: '솔직히 말씀드리면 이제 막 문을 열었습니다. 그래서 초기 입점 매장에 노출을 몰아드리고, 광고도 저희가 돌립니다. 숫자부터 부풀려 말씀드리지 않겠습니다.',
  },
  {
    q: '매일 올려야 하나요?',
    a: '아닙니다. 조건이 바뀔 때만 보내주시면 됩니다. 오래된 시세표는 자동으로 뒤로 내려갑니다.',
  },
];

export default function SellerPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <section className="rounded-2xl bg-zz-600 px-6 py-10 text-center text-white sm:px-10 sm:py-14">
        <p className="text-sm font-semibold text-zz-100">성지 운영하세요?</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          우리 매장 조건,
          <br />
          찍고에 무료로 올려드립니다.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-zz-50 sm:text-base">
          카톡으로 쓰시던 시세표 그대로 보내주세요.
          <br className="hidden sm:block" /> 입력도, 정리도 저희가 합니다.
        </p>
        <a
          href="#apply"
          className="mt-7 inline-block rounded-xl bg-white px-7 py-3.5 text-[15px] font-bold text-zz-700 hover:bg-zz-50"
        >
          1분이면 신청 끝
        </a>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        {BENEFITS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-zz-50 text-zz-600">
              <Icon size={19} />
            </span>
            <h2 className="mt-3 font-bold text-gray-900">{title}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-bold text-gray-900">이렇게 진행됩니다</h2>
        <ol className="mt-4 space-y-4">
          {[
            ['신청', '아래 폼에 연락처만 남겨주세요. 가입 안 하셔도 됩니다.'],
            ['연락', '영업일 1~2일 안에 전화드려 조건과 공개 범위를 맞춥니다.'],
            ['등록', '매장 페이지를 만들고 첫 시세표를 올려드립니다.'],
            ['운영', '조건이 바뀔 때만 카톡으로 보내주세요. 바로 반영됩니다.'],
          ].map(([title, body], index) => (
            <li key={title} className="flex gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zz-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <span className="min-w-0 pt-0.5">
                <b className="block text-[15px] text-gray-900">{title}</b>
                <span className="mt-0.5 block text-sm leading-relaxed text-gray-600">{body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section id="apply" className="mt-8 scroll-mt-20">
        <SellerApplyForm />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold text-gray-900">자주 묻는 것</h2>
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
          {FAQ.map(({ q, a }) => (
            <li key={q} className="px-5 py-4">
              <p className="font-semibold text-gray-900">{q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{a}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
