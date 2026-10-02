import {
  CircleHelp,
  Hand,
  Home,
  List,
  Megaphone,
  MessagesSquare,
  Newspaper,
  PenSquare,
  Scale,
  Search,
  ShoppingBag,
  Store,
  Tags,
  UserRound,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import type { BoardGroup } from './types';

export interface MenuItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface MenuGroup {
  name: string;
  items: MenuItem[];
}

/** 항상 첫 번째에 고정되는 메뉴 */
export const HOME_MENU_ID = 'home';
export const DEFAULT_FAVORITES = [HOME_MENU_ID, 'board:deals', 'board:news', 'board:qna'];
/** 홈(고정)을 제외하고 추가할 수 있는 최대 개수 */
export const MAX_FAVORITES = 5;

const BOARD_ICONS: Record<string, LucideIcon> = {
  notice: Megaphone,
  greeting: Hand,
  deals: Tags,
  news: Newspaper,
  specs: Scale,
  qna: CircleHelp,
  review: Store,
  free: MessagesSquare,
  market: ShoppingBag,
  internet: Wifi,
};

const BASE_MENUS: MenuGroup[] = [
  {
    name: '기본',
    items: [
      { id: HOME_MENU_ID, label: '홈', href: '/', icon: Home },
      { id: 'all', label: '전체글보기', href: '/board/all', icon: List },
      { id: 'write', label: '글쓰기', href: '/write', icon: PenSquare },
      { id: 'mypage', label: '마이페이지', href: '/mypage', icon: UserRound },
      { id: 'search', label: '검색', href: '/search', icon: Search },
    ],
  },
];

/** 기본 메뉴 + 게시판 목록을 합쳐 고를 수 있는 전체 메뉴를 만든다 */
export function buildMenuCatalog(boardGroups: BoardGroup[]): MenuGroup[] {
  return [
    ...BASE_MENUS,
    ...boardGroups.map((group) => ({
      // 그룹 이름 앞의 이모지는 메뉴에서 빼고 쓴다
      name: group.name.replace(/^\p{Extended_Pictographic}\s*/u, ''),
      items: group.boards.map((board) => ({
        id: `board:${board.slug}`,
        label: board.name,
        href: `/board/${board.slug}`,
        icon: BOARD_ICONS[board.slug] ?? List,
      })),
    })),
  ];
}

export function getMenuItems(catalog: MenuGroup[], ids: string[]) {
  const byId = new Map(catalog.flatMap((group) => group.items).map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter((item): item is MenuItem => Boolean(item));
}

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}
