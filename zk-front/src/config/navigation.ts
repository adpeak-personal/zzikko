export type CategoryNav = {
  slug: string;
  title: string;
  icon: string;
  desc: string;
  color: string;
  text: string;
};

export const CATEGORIES: CategoryNav[] = [
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
    slug: "hotdeal",
    title: "핫딜 정보",
    icon: "🔥",
    desc: "실시간 특가·핫딜 공유",
    color: "bg-pink-50",
    text: "text-pink-600",
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
];
