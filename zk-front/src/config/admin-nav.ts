export type AdminNavItem = {
  href: string;
  title: string;
  icon: string;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", title: "대시보드", icon: "🏠" },
  { href: "/admin/members", title: "회원관리", icon: "👥" },
  { href: "/admin/blog", title: "블로그 발행", icon: "✍️" },
  { href: "/admin/posts", title: "게시글관리", icon: "📝" },
  { href: "/admin/keywords", title: "키워드관리", icon: "🏷️" },
  { href: "/admin/reports", title: "신고관리", icon: "🚨" },
  { href: "/admin/settings", title: "설정", icon: "⚙️" },
];
