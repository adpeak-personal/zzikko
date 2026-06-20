"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BACK_API, saveTokens, type LoginResult } from "@/lib/auth";

type Mode = "login" | "register";

export default function MasterLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BACK_API}/api/auth/master`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? (mode === "login" ? "로그인 실패" : "회원가입 실패"));
      }
      const data = (await res.json()) as LoginResult;
      saveTokens(data.accessToken, data.refreshToken);
      router.replace("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1115] flex items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col gap-5"
      >
        <h1 className="text-white text-lg font-semibold tracking-tight">관리자</h1>

        {/* 탭 */}
        <div className="flex bg-white/5 rounded-xl p-1 gap-1">
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 text-xs font-medium">이메일</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors"
            placeholder="admin@example.com"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-slate-400 text-xs font-medium">마스터 키</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500 transition-colors"
            placeholder="••••••••"
          />
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
        >
          {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
        </button>
      </form>
    </div>
  );
}
