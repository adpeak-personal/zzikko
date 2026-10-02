import Link from 'next/link';
import { LogoMark } from '@/components/layout/Logo';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <LogoMark size={56} />
      <p className="mt-6 text-sm font-bold text-zz-600">404</p>
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-gray-900">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-gray-500">주소가 바뀌었거나 삭제된 글일 수 있습니다.</p>
      <div className="mt-7 flex gap-2">
        <Link href="/" className="rounded-xl bg-zz-600 px-5 py-3 font-bold text-white hover:bg-zz-700">
          홈으로
        </Link>
        <Link href="/board/all" className="rounded-xl border border-gray-200 bg-white px-5 py-3 font-bold text-gray-700 hover:border-gray-300">
          전체글보기
        </Link>
      </div>
    </main>
  );
}
