import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldCheck, Store, Wifi } from 'lucide-react';
import { Card, PageTitle } from '@/components/ui';

export const metadata: Metadata = { title: '이용 안내' };

const SECTIONS = [
  {
    id: 'community',
    icon: ShieldCheck,
    title: '커뮤니티 이용 안내',
    body: [
      '판매자는 가입 조건을 투명하게, 회원은 경험을 솔직하게 나누는 커뮤니티를 지향합니다.',
      '시세 글에는 할부원금과 요금제 유지 기간, 부가서비스 조건을 함께 적도록 하고 있습니다. 개인 연락처는 본문에 남기지 말아주세요.',
    ],
  },
  {
    id: 'seller',
    icon: Store,
    title: '판매자 참여 안내',
    body: [
      '사업자등록증과 사전승낙서를 확인한 뒤 인증 배지를 드립니다. 인증 판매자만 시세 게시판에 글을 쓸 수 있습니다.',
      '매장 프로필에는 등록한 시세와 받은 후기가 함께 표시됩니다. 조건을 자세히 적을수록 문의가 늘어납니다.',
    ],
  },
  {
    id: 'life',
    icon: Wifi,
    title: '인터넷 · 생활 서비스',
    body: [
      '인터넷 가입과 결합 할인, 이사 같은 생활 서비스도 게시판으로 다룹니다.',
      '결합은 회선 수와 약정 조건에 따라 달라지므로, 질문하실 때 현재 상품과 회선 수를 함께 적어주세요.',
    ],
  },
];

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title="이용 안내" desc="찍고는 동네 판매자와 이웃이 함께 만드는 휴대폰·통신 커뮤니티입니다." />

      <div className="space-y-4">
        {SECTIONS.map(({ id, icon: Icon, title, body }) => (
          <Card key={id} id={id} className="flex gap-4 px-6 py-6">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-zz-50 text-zz-600">
              <Icon size={21} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {body.map((paragraph) => (
                <p key={paragraph} className="mt-2 leading-relaxed text-gray-600">
                  {paragraph}
                </p>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/write" className="rounded-xl bg-zz-600 px-5 py-3 font-bold text-white hover:bg-zz-700">
          글쓰기
        </Link>
        <Link href="/board/all" className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:border-gray-300">
          게시판 둘러보기
        </Link>
      </div>
    </div>
  );
}
