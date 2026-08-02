export type YongadmNavItem = {
  href: string;
  title: string;
  icon: string;
};

export const YONGADM_NAV: YongadmNavItem[] = [
  { href: "/yongadm", title: "대시보드", icon: "🏠" },
  { href: "/yongadm/accounts", title: "아이디 관리", icon: "🆔" },
  { href: "/yongadm/blog", title: "블로그 발행 관리", icon: "✍️" },
  { href: "/yongadm/traffic", title: "트래픽 관리", icon: "📈" },
  { href: "/yongadm/backlinks", title: "백링크 관리", icon: "🔗" },
];
