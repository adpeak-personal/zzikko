import Link from 'next/link';
import { Bell, LogIn, PenSquare, Search } from 'lucide-react';
import { SITE } from '@/config/brand';
import { getBoardGroups, getCurrentUser } from '@/lib/data';
import { Avatar } from '@/components/ui';
import { BrandLogo } from './Logo';
import { MobileMenu } from './MobileMenu';
import { FavoriteMenuBar } from './FavoriteMenuBar';

export async function Header() {
  const [me, boardGroups] = await Promise.all([getCurrentUser(), getBoardGroups()]);

  return (
    // 주의: header 에 backdrop-blur/transform 을 주면 내부 fixed 드로어가 헤더 안에 갇힌다
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-4">
        <MobileMenu boardGroups={boardGroups} />

        <Link href="/" aria-label={`${SITE.name} 홈`}>
          <BrandLogo />
        </Link>

        <form action="/search" className="ml-3 hidden flex-1 md:block" role="search">
          <label className="flex max-w-md items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5 text-gray-500 focus-within:ring-2 focus-within:ring-zz-300">
            <Search size={17} />
            <span className="sr-only">검색</span>
            <input name="q" placeholder="기종, 지역, 매장 검색" className="w-full bg-transparent text-[15px] text-gray-900 outline-none" />
          </label>
        </form>

        <div className="ml-auto flex items-center gap-1">
          <Link href="/search" className="rounded-full p-2 text-gray-600 hover:bg-gray-100 md:hidden" aria-label="검색">
            <Search size={20} />
          </Link>
          <Link
            href="/write"
            className="hidden items-center gap-1.5 rounded-full bg-zz-600 px-4 py-2 text-sm font-bold text-white hover:bg-zz-700 sm:flex"
          >
            <PenSquare size={15} /> 글쓰기
          </Link>

          {me ? (
            <>
              <button type="button" className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100" aria-label="알림">
                <Bell size={20} />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-zz-500" />
              </button>
              <Link href="/mypage" className="flex items-center rounded-full p-1 hover:bg-gray-100" aria-label="마이페이지">
                <Avatar user={me} size={32} />
              </Link>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
            >
              <LogIn size={16} /> 로그인
            </Link>
          )}
        </div>
      </div>

      <FavoriteMenuBar boardGroups={boardGroups} />
    </header>
  );
}
