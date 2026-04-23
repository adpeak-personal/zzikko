"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Role = "buyer" | "seller";

const ROLE_META: Record<Role, { label: string; sub: string; accent: string; ring: string }> = {
  buyer: {
    label: "구매자",
    sub: "분양 정보 탐색 · 찜 · 문의",
    accent: "from-sky-500 to-blue-600",
    ring: "focus:ring-blue-200",
  },
  seller: {
    label: "판매자",
    sub: "매물 등록 · 상담 관리 · 통계",
    accent: "from-amber-500 to-orange-600",
    ring: "focus:ring-amber-200",
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("buyer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = ROLE_META[role];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      router.push(role === "seller" ? "/seller" : "/");
    } catch {
      setError("로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        fontFamily: "var(--font-suite)",
        background:
          "radial-gradient(1200px 600px at 10% -10%, #dbeafe 0%, transparent 60%), radial-gradient(900px 500px at 110% 10%, #fef3c7 0%, transparent 55%), #f8fafc",
      }}
    >
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center gap-2 text-2xl font-extrabold text-slate-800">
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-amber-500 text-white shadow-md">
              ⚡
            </span>
            번개분양
          </div>
          <p className="mt-2 text-sm text-slate-500">빠르고 정확한 분양 정보</p>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
            {(Object.keys(ROLE_META) as Role[]).map((r) => {
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`relative h-11 rounded-lg text-sm font-bold transition-all ${
                    active
                      ? `bg-gradient-to-r ${ROLE_META[r].accent} text-white shadow`
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {ROLE_META[r].label}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-slate-500 -mt-3 mb-5 text-center">{meta.sub}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                이메일
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`base-input ${meta.ring}`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`base-input pr-12 ${meta.ring}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700"
                >
                  {showPw ? "숨기기" : "보이기"}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
                로그인 유지
              </label>
              <Link
                href="/auth/find-password"
                className="text-slate-500 hover:text-slate-800"
              >
                비밀번호 찾기
              </Link>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`btn-base w-full h-12 bg-gradient-to-r ${meta.accent}`}
            >
              {loading ? "로그인 중..." : `${meta.label}로 로그인`}
            </button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs text-slate-400">또는 간편 로그인</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <SocialButton label="카카오" bg="#FEE500" color="#000">
              K
            </SocialButton>
            <SocialButton label="네이버" bg="#03C75A" color="#fff">
              N
            </SocialButton>
            <SocialButton label="구글" bg="#fff" color="#1f2937" border>
              G
            </SocialButton>
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          아직 회원이 아니신가요?{" "}
          <Link
            href={`/auth/register?role=${role}`}
            className="font-bold text-slate-800 hover:underline"
          >
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}

function SocialButton({
  children,
  label,
  bg,
  color,
  border,
}: {
  children: React.ReactNode;
  label: string;
  bg: string;
  color: string;
  border?: boolean;
}) {
  return (
    <button
      type="button"
      className={`h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all hover:-translate-y-0.5 active:translate-y-0 ${
        border ? "border border-slate-200" : ""
      }`}
      style={{ background: bg, color }}
    >
      <span className="w-5 h-5 rounded-full bg-white/50 flex items-center justify-center text-[11px] font-black">
        {children}
      </span>
      {label}
    </button>
  );
}
