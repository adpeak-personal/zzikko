"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { startKakaoLogin } from "@/lib/auth";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleKakaoLogin = async () => {
    try {
      setLoading(true);
      await startKakaoLogin(); // 카카오 인가 페이지로 이동
    } catch (e) {
      setLoading(false);
      alert(e instanceof Error ? e.message : "로그인 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1115] text-white font-sans relative overflow-hidden flex flex-col">
      {/* 배경 글로우 */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-blue-600/20 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[500px] h-[400px] bg-cyan-500/10 blur-[140px] rounded-full pointer-events-none" />

      {/* 상단 로고/뒤로가기 */}
      <header className="relative z-10 max-w-5xl w-full mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-2xl font-black bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-cyan-400 tracking-tighter group-hover:scale-105 transition-transform">
            찍고
          </span>
        </Link>
        <Link
          href="/"
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          닫기
        </Link>
      </header>

      {/* 메인 영역 */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          {/* 헤드라인 */}
          <div className="text-center mb-5">
            <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-bold px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              번거로운 가입절차 NO
            </div>

            <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-snug">
              <span className="bg-clip-text text-transparent bg-linear-to-r from-blue-400 to-cyan-400">
                간편하게
              </span>
              <br />
              <span className="text-white">찍고 서비스를 이용하세요</span>
            </h1>
            <p className="text-sm text-slate-400 mt-4 leading-relaxed">
              복잡한 가입절차 없이
              <br />
              지금 바로 시작할 수 있어요.
            </p>
          </div>

          {/* 로그인 카드 */}
          <div className="bg-[#1a1d23] border border-white/10 rounded-3xl p-7 shadow-2xl shadow-black/40">
            {/* 카카오 로그인 버튼 */}
            <button
              onClick={handleKakaoLogin}
              disabled={loading}
              className="w-full h-14 bg-[#FEE500] hover:bg-[#FDD800] active:scale-[0.98] text-[#191919] rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all shadow-lg shadow-yellow-500/10 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              <Image
                src="/kakao_logo.png"
                width={20}
                height={20}
                alt="카카오"
                className="object-contain"
              />
              {loading ? "카카오로 이동 중..." : "카카오로 간편하게 시작하기"}
            </button>

            {/* 네이버 자리 (준비중) */}
            {/* <button
              disabled
              className="mt-3 w-full h-14 bg-white/5 border border-white/5 text-slate-500 rounded-2xl font-bold text-base flex items-center justify-center gap-3 cursor-not-allowed"
            >
              <span className="w-5 h-5 rounded-md bg-[#03C75A]/40 text-white text-[11px] font-black flex items-center justify-center">
                N
              </span>
              네이버 로그인 (준비중)
            </button> */}

            {/* 안내문 */}
            <p className="text-[11px] text-slate-500 text-center leading-relaxed mt-6">
              로그인 시{" "}
              <Link href="/terms" className="text-slate-300 underline underline-offset-2 hover:text-white">
                이용약관
              </Link>
              {" 및 "}
              <Link href="/privacy" className="text-slate-300 underline underline-offset-2 hover:text-white">
                개인정보 처리방침
              </Link>
              에<br />
              동의하는 것으로 간주됩니다.
            </p>
          </div>

          {/* 하단 셀링 포인트 */}
          <ul className="mt-8 space-y-2.5 text-sm text-slate-400">
            <li className="flex items-center gap-2.5">
              <CheckIcon />
              가입 별도 절차 없이 즉시 이용
            </li>
            <li className="flex items-center gap-2.5">
              <CheckIcon />
              내 주변 성지·시세 알림 받기
            </li>
            <li className="flex items-center gap-2.5">
              <CheckIcon />
              찜한 매장·후기 한 곳에서 관리
            </li>
          </ul>
        </div>
      </main>

      <footer className="relative z-10 text-center text-[11px] text-slate-600 pb-6">
        © {new Date().getFullYear()} 찍고. 성지를 찍고, 가격을 찍고.
      </footer>
    </div>
  );
}

function CheckIcon() {
  return (
    <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-3 h-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  );
}
