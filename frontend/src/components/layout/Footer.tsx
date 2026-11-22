import Link from 'next/link';
import { SITE } from '@/config/brand';

export function Footer() {
  return (
    <footer className="mt-10 border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-lg font-extrabold tracking-tight text-gray-900">
            {SITE.name}<span className="text-zz-500">.</span>
          </p>
          <nav className="flex flex-wrap gap-5 text-sm text-gray-500" aria-label="하단 메뉴">
            <Link href="/board/notice" className="hover:text-gray-900">공지사항</Link>
            <Link href="/guide" className="hover:text-gray-900">이용 안내</Link>
            <Link href="/seller" className="hover:text-gray-900">판매자 입점</Link>
            <Link href="/terms" className="hover:text-gray-900">이용약관</Link>
            {/* 개인정보처리방침은 다른 링크보다 눈에 띄게 두는 게 원칙이다 */}
            <Link href="/privacy" className="font-bold text-gray-700 hover:text-gray-900">개인정보처리방침</Link>
          </nav>
        </div>
        <p className="mt-5 border-t border-gray-100 pt-5 text-xs leading-relaxed text-gray-400">
          © 2026 ZZIKKO · 커뮤니티 컨셉 미리보기입니다. 게시글·판매자·시세·수치는 모두 예시이며 실제 판매·상담 서비스가 아닙니다.
        </p>
      </div>
    </footer>
  );
}
