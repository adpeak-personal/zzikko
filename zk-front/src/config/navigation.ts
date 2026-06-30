export type CategoryNav = {
  slug: string;
  title: string;
  icon: string;
  desc: string;
  color: string;
  text: string;
  /** true 면 메가메뉴/모바일 사이드바에서 숨김. URL 접근 / CategoryHeader 메타데이터는 그대로 동작. */
  hiddenFromNav?: boolean;
  /** 1뎁스 더 — 자유게시판 같은 게시판은 sub_slug 로 한번 더 분류 */
  subs?: SubCategoryNav[];
};

export type SubCategoryNav = {
  slug: string;
  title: string;
  icon?: string;
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
    slug: "tips",
    title: "꿀팁게시판",
    icon: "💡",
    desc: "호갱 탈출 필수 지식",
    color: "bg-green-50",
    text: "text-green-600",
  },
  {
    slug: "qna",
    title: "질문·답변",
    icon: "❓",
    desc: "궁금한 부분 물어보세요",
    color: "bg-gray-50",
    text: "text-gray-600",
  },
  {
    slug: "devices",
    title: "휴대폰 정보",
    icon: "📱",
    desc: "신규 기종 스펙 비교",
    color: "bg-orange-50",
    text: "text-orange-600",
  },
  // ──────────────────────────────────────────────────────────────────
  // 자유게시판 — sub_slug 로 1뎁스 더 분류
  // ──────────────────────────────────────────────────────────────────
  {
    slug: "free",
    title: "자유게시판",
    icon: "💬",
    desc: "잡담·유머·질문 등 자유 주제",
    color: "bg-slate-50",
    text: "text-slate-700",
    subs: [
      { slug: "chat", title: "잡담", icon: "🗨️" },
      { slug: "humor", title: "유머", icon: "😆" },
      { slug: "question", title: "질문", icon: "❓" },
      { slug: "info", title: "정보공유", icon: "💡" },
    ],
  },
  // ──────────────────────────────────────────────────────────────────
  // AI 자동 발행 블로그 — 메인 네비에서는 숨김. 직접 URL/푸터로만 접근.
  // ──────────────────────────────────────────────────────────────────
  {
    slug: "blog",
    title: "Blog",
    icon: "📰",
    desc: "정보성 블로그 글",
    color: "bg-zinc-50",
    text: "text-zinc-700",
    hiddenFromNav: true,
  },
];
