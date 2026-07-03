// 상위 카테고리(게시판) 정적 정의.
// 서브카테고리는 DB(`board_subs`) 에서 어드민이 관리 — 여기 배열에는 두지 않음.
// 렌더 시엔 `service/board-subs/server.ts` 의 `getBoardSubs(slug)` 를 사용.
export type CategoryNav = {
  slug: string;
  title: string;
  icon: string;
  desc: string;
  color: string;
  text: string;
  /** true 면 메가메뉴/모바일 사이드바에서 숨김. URL 접근 / CategoryHeader 메타데이터는 그대로 동작. */
  hiddenFromNav?: boolean;
};

export const CATEGORIES: CategoryNav[] = [
  {
    slug: "hotdeal",
    title: "핫딜 정보",
    icon: "🔥",
    desc: "실시간 특가·핫딜 공유",
    color: "bg-pink-50",
    text: "text-pink-600",
  },
  {
    slug: "offline",
    title: "휴대폰 성지",
    icon: "📍",
    desc: "내 주변 최저가 좌표",
    color: "bg-red-50",
    text: "text-red-600",
  },
  {
    slug: "online",
    title: "온라인 성지",
    icon: "🌐",
    desc: "전국 비대면 초특가",
    color: "bg-blue-50",
    text: "text-blue-600",
  },
  {
    slug: "internet-tv",
    title: "인터넷+TV",
    icon: "📺",
    desc: "최대 현금 사은품",
    color: "bg-purple-50",
    text: "text-purple-600",
  },
  {
    slug: "reviews",
    title: "이용후기",
    icon: "⭐️",
    desc: "실제 이용자 리얼 리뷰",
    color: "bg-yellow-50",
    text: "text-yellow-600",
  },
  {
    slug: "devices",
    title: "휴대폰 정보",
    icon: "📱",
    desc: "신규 기종 스펙 비교",
    color: "bg-orange-50",
    text: "text-orange-600",
  },
  {
    slug: "community",
    title: "커뮤니티",
    icon: "💬",
    desc: "후기·꿀팁·질문·잡담까지 유저 커뮤니티",
    color: "bg-slate-50",
    text: "text-slate-700",
  },
];
