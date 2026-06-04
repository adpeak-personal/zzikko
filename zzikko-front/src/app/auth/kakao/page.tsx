"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginWithKakaoCode } from "@/lib/auth";

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={<Loading />}>
      <KakaoCallback />
    </Suspense>
  );
}

function Loading() {
  return (
    <div className="min-h-screen bg-[#0f1115] text-white flex flex-col items-center justify-center gap-4">
      <span className="w-8 h-8 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
      <p className="text-slate-400 text-sm">카카오 로그인 처리 중...</p>
    </div>
  );
}

function KakaoCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false); // StrictMode 이중 실행 방지

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get("code");
    const kakaoError = params.get("error");

    if (kakaoError) {
      setError("카카오 인증이 취소되었습니다.");
      return;
    }
    if (!code) {
      setError("인가 코드가 없습니다.");
      return;
    }

    loginWithKakaoCode(code)
      .then(() => {
        router.replace("/"); // 로그인 성공 → 홈으로
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
      });
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#0f1115] text-white flex flex-col items-center justify-center gap-4">
      {error ? (
        <>
          <p className="text-red-400 font-bold">{error}</p>
          <button
            onClick={() => router.replace("/auth/login")}
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors"
          >
            로그인으로 돌아가기
          </button>
        </>
      ) : (
        <>
          <span className="w-8 h-8 rounded-full border-2 border-blue-400/30 border-t-blue-400 animate-spin" />
          <p className="text-slate-400 text-sm">카카오 로그인 처리 중...</p>
        </>
      )}
    </div>
  );
}
