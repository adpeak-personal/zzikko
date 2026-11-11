'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List } from 'lucide-react';
import { isActive } from '@/lib/menu';
import { cn } from '@/lib/utils';
import type { BoardGroup } from '@/lib/types';

/**
 * 사이드바의 게시판 목록.
 *
 * Sidebar 는 서버 컴포넌트라 현재 주소를 알 수 없다. 지금 보고 있는 메뉴에 표시를
 * 하려면 주소가 필요해서 이 부분만 클라이언트로 떼어 놓았다.
 * (모바일 메뉴·자주 쓰는 메뉴는 이미 같은 방식으로 표시하고 있었다.)
 */
export function SidebarBoards({ boardGroups }: { boardGroups: BoardGroup[] }) {
  const pathname = usePathname();
  const allActive = isActive(pathname, '/board/all');

  return (
    <nav className="rounded-2xl border border-gray-200 bg-white py-2">
      <Link
        href="/board/all"
        aria-current={allActive ? 'page' : undefined}
        className={cn(
          'mx-2 mb-1 flex items-center gap-2 rounded-xl px-3 py-2.5 font-bold transition',
          allActive ? 'bg-zz-50 text-zz-700' : 'text-gray-900 hover:bg-gray-50',
        )}
      >
        <List size={16} className={allActive ? 'text-zz-600' : 'text-gray-400'} /> 전체글보기
      </Link>

      {boardGroups.map((group) => (
        <div key={group.id} className="border-t border-gray-100 py-1.5">
          <p className="px-5 py-1 text-xs font-bold text-gray-400">{group.name}</p>
          <ul>
            {group.boards.map((board) => {
              const active = isActive(pathname, `/board/${board.slug}`);
              return (
                <li key={board.id}>
                  <Link
                    href={`/board/${board.slug}`}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      // 선택된 메뉴는 왼쪽에 색 막대를 둔다 — 글자만 굵게 하면 눈에 안 띈다
                      'flex items-center justify-between border-l-2 py-1.5 pl-[18px] pr-5 text-[15px] transition',
                      active
                        ? 'border-zz-600 bg-zz-50 font-bold text-zz-700'
                        : 'border-transparent text-gray-700 hover:bg-zz-50 hover:text-zz-700',
                    )}
                  >
                    <span>{board.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
