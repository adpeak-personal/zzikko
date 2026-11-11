'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, PenSquare, X } from 'lucide-react';
import { SITE } from '@/config/brand';
import type { BoardGroup } from '@/lib/types';
import { isActive } from '@/lib/menu';
import { cn } from '@/lib/utils';
import { BrandLogo } from './Logo';

const TOOLS = [{ href: '/write', label: '글쓰기', icon: PenSquare }];

/** 모바일 전체 메뉴 (왼쪽 드로어) */
export function MobileMenu({ boardGroups }: { boardGroups: BoardGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // 주소가 바뀌면 자동으로 닫는다
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-2 text-gray-700 hover:bg-gray-100 lg:hidden" aria-label="전체 메뉴">
        <Menu size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="전체 메뉴">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-label="닫기" />

          <div className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3.5">
              <Link href="/" aria-label={`${SITE.name} 홈`}>
                <BrandLogo size={28} />
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-gray-400 hover:bg-gray-100" aria-label="닫기">
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
              <ul className="mb-3">
                {TOOLS.map((tool) => {
                  const active = isActive(pathname, tool.href);
                  return (
                    <li key={tool.href}>
                      <Link
                        href={tool.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-2.5 rounded-xl px-3 py-3 font-semibold transition',
                          active ? 'bg-zz-50 text-zz-700' : 'text-gray-800 hover:bg-zz-50',
                        )}
                      >
                        <tool.icon size={17} className={active ? 'text-zz-600' : 'text-zz-500'} />
                        {tool.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <Link
                href="/board/all"
                aria-current={isActive(pathname, '/board/all') ? 'page' : undefined}
                className={cn(
                  'mx-1 mb-2 block rounded-xl px-3 py-2.5 font-bold transition',
                  isActive(pathname, '/board/all') ? 'bg-zz-50 text-zz-700' : 'text-gray-900 hover:bg-gray-50',
                )}
              >
                전체글보기
              </Link>

              {boardGroups.map((group) => (
                <div key={group.id} className="border-t border-gray-100 py-2">
                  <p className="px-4 py-1 text-xs font-bold text-gray-400">{group.name}</p>
                  <ul>
                    {group.boards.map((board) => {
                      const active = isActive(pathname, `/board/${board.slug}`);
                      return (
                        <li key={board.id}>
                          <Link
                            href={`/board/${board.slug}`}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              // 사이드바와 같은 방식 — 왼쪽 색 막대 + 연한 배경
                              'block rounded-r-xl border-l-2 py-2 pl-3.5 pr-4 text-[15px] transition',
                              active
                                ? 'border-zz-600 bg-zz-50 font-bold text-zz-700'
                                : 'border-transparent text-gray-700 hover:bg-zz-50',
                            )}
                          >
                            {board.name}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
