'use client';

import Link from "next/link";
import Logo from "@/components/common/Logo";
import { CATEGORIES } from "@/config/navigation";


export default function Home({ serverUser }: { serverUser: any }) {


  // ⭐ 핵심: Zustand 스토어에 데이터가 아직 없다면(하이드레이션 전),
  // 서버에서 넘겨받은 데이터를 우선적으로 보여준다!
  // const currentUser = user || serverUser;

  const menus = CATEGORIES;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      {/* GNB */}
      <nav className="bg-[#0f1115] border-b border-white/5">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo width={140} priority />


          <Link href="/auth/login" className="text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-all">
            로그인
          </Link>


        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#0f1115] pt-16 pb-24 px-6">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-125 h-75 bg-blue-600/20 blur-[120px] rounded-full z-0"></div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">
            성지를 <span className="text-blue-400">찍고</span>, 가격을{" "}
            <span className="text-cyan-400">찍고</span>
          </h1>

          <div className="relative max-w-xl mx-auto group mt-10">
            <div className="absolute -inset-1 bg-linear-to-r from-blue-600 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
            <div className="relative flex bg-[#1a1d23] p-1.5 rounded-2xl border border-white/10 shadow-2xl">
              <input
                type="text"
                placeholder="원하는 서비스를 입력해 보세요"
                className="bg-transparent flex-1 px-5 py-3 text-sm outline-none text-white placeholder:text-slate-500"
              />
              <button className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
                <span>검색</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="3"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </section>



      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 -mt-10 mb-20 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {menus.map((menu) => (
            <Link
              key={menu.slug}
              href={`/category/${menu.slug}`}
              className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all hover:-translate-y-1"
            >
              <div
                className={`w-12 h-12 ${menu.color} rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}
              >
                {menu.icon}
              </div>
              <h3 className="font-bold text-slate-800 text-base mb-1">
                {menu.title}
              </h3>
              <p className="text-[11px] text-slate-400 leading-tight">
                {menu.desc}
              </p>
            </Link>
          ))}

          {/* 실시간 시세표 카드
          <div className="col-span-2 md:col-span-1 bg-slate-900 p-6 rounded-2xl shadow-xl flex flex-col justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 p-2 opacity-10 text-6xl font-black text-white">
              !
            </div>
            <div className="relative z-10">
              <h3 className="text-white font-bold text-lg leading-tight">
                오늘의
                <br />
                실시간 시세표
              </h3>
            </div>
            <button className="relative z-10 mt-4 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black py-2.5 rounded-lg transition-colors tracking-widest uppercase">
              Check Now
            </button>
          </div> */}
        </div>


        {/* Board Sections */}
        <div className="mt-16 grid md:grid-cols-2 gap-10">
          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-slate-900">
                🔥 실시간 인기글
              </h2>
              <button className="text-xs text-slate-400 hover:text-blue-600">
                더보기 +
              </button>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 group cursor-pointer">
                  <span className="text-blue-600 font-black italic">{i}</span>
                  <p className="text-sm text-slate-600 group-hover:text-blue-600 transition-colors">
                    성지 방문 전 필수 체크리스트 공유합니다!
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-extrabold text-slate-900">
                💬 최근 질문
              </h2>
              <button className="text-xs text-slate-400 hover:text-blue-600">
                더보기 +
              </button>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 border border-transparent hover:border-slate-200 transition-all cursor-pointer"
                >
                  S24 울트라 자급제 vs 성지 고민입니다...
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}