'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SlidersHorizontal } from 'lucide-react';
import { buildMenuCatalog, getMenuItems, isActive } from '@/lib/menu';
import { useFavoriteMenus } from '@/hooks/useFavoriteMenus';
import { cn } from '@/lib/utils';
import type { BoardGroup } from '@/lib/types';
import { FavoriteMenuEditor } from './FavoriteMenuEditor';

/** 헤더 아래 개인별 자주 쓰는 메뉴 (태블릿 이상) */
export function FavoriteMenuBar({ boardGroups }: { boardGroups: BoardGroup[] }) {
  const pathname = usePathname();
  const { ids } = useFavoriteMenus();
  const [editing, setEditing] = useState(false);

  const catalog = buildMenuCatalog(boardGroups);
  const items = getMenuItems(catalog, ids);

  return (
    <nav className="mx-auto hidden max-w-6xl items-center gap-3 px-4 md:flex" aria-label="자주 쓰는 메뉴">
      <ul className="scrollbar-none -mb-px flex min-w-0 gap-6 overflow-x-auto">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-[15px] font-semibold',
                  active ? 'border-zz-500 text-zz-700' : 'border-transparent text-gray-500 hover:border-zz-200 hover:text-zz-700',
                )}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      >
        <SlidersHorizontal size={13} />
        편집
      </button>

      <FavoriteMenuEditor catalog={catalog} open={editing} onClose={() => setEditing(false)} />
    </nav>
  );
}
