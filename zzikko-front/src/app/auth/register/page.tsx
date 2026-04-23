"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Role = "buyer" | "seller";

const ROLE_META: Record<Role, { label: string; sub: string; accent: string; ring: string }> = {
  buyer: {
    label: "구매자",
    sub: "관심 분양 정보를 빠르게 받아보세요",
    accent: "from-sky-500 to-blue-600",
    ring: "focus:ring-blue-200",
  },
  seller: {
    label: "판매자",
    sub: "매물을 등록하고 상담을 관리하세요",
    accent: "from-amber-500 to-orange-600",
    ring: "focus:ring-amber-200",
  },
};

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const initialRole = (params.get("role") as Role) === "seller" ? "seller" : "buyer";

  const [role, setRole] = useState<Role>(initialRole);
  const [form, setForm] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    phone: "",
    companyName: "",
    businessNumber: "",
  });
  const [agreeAll, setAgreeAll] = useState(false);
  const [agree, setAgree] = useState({ tos: false, privacy: false, marketing: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = ROLE_META[role];

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const passwordMismatch = useMemo(
    () => !!form.passwordConfirm && form.password !== form.passwordConfirm,
    [form.password, form.passwordConfirm],
  );

  const toggleAll = (v: boolean) => {
    setAgreeAll(v);
    setAgree({ tos: v, privacy: v, marketing: v });
  };

  const toggleOne = (key: keyof typeof agree, v: boolean) => {
    const next = { ...agree, [key]: v };
    setAgree(next);
    setAgreeAll(next.tos && next.privacy && next.marketing);
  };

  const canSubmit =
    form.email &&
    form.password.length >= 8 &&
    !passwordMismatch &&
    form.name &&
    form.phone &&
    agree.tos &&
    agree.privacy &&
    (role === "buyer" || (form.companyName && form.businessNumber));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("필수 항목을 모두 입력하고 약관에 동의해주세요.");
      return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      router.push("/auth/login");
    } catch {
      setError("가입에 실패했어요. 잠시 후 다시 시도해주세요.");
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
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-6">
          <Link
            href="/auth/login"
            className="flex items-center gap-2 text-2xl font-extrabold text-slate-800"
          >
            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-amber-500 text-white shadow-md">
              ⚡
            </span>
            번개분양
          </Link>
          <p className="mt-2 text-sm text-slate-500">회원가입</p>
        </div>

        <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-4">
            {(Object.keys(ROLE_META) as Role[]).map((r) => {
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`h-11 rounded-lg text-sm font-bold transition-all ${
                    active
                      ? `bg-gradient-to-r ${ROLE_META[r].accent} text-white shadow`
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {ROLE_META[r].label} 가입
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mb-6 text-center">{meta.sub}</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="이메일" required>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update("email")}
                className={`base-input ${meta.ring}`}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="비밀번호 (8자 이상)" required>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={update("password")}
                  className={`base-input ${meta.ring}`}
                />
              </Field>
              <Field label="비밀번호 확인" required error={passwordMismatch ? "비밀번호가 일치하지 않아요" : undefined}>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={form.passwordConfirm}
                  onChange={update("passwordConfirm")}
                  className={`base-input ${meta.ring}`}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="이름" required>
                <input
                  type="text"
                  placeholder="홍길동"
                  value={form.name}
                  onChange={update("name")}
                  className={`base-input ${meta.ring}`}
                />
              </Field>
              <Field label="휴대폰 번호" required>
                <input
                  type="tel"
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={update("phone")}
                  className={`base-input ${meta.ring}`}
                />
              </Field>
            </div>

            {role === "seller" && (
              <div className="rounded-xl bg-amber-50/60 border border-amber-100 p-4 space-y-4">
                <p className="text-xs font-bold text-amber-700">판매자 추가 정보</p>
                <Field label="상호명(업체명)" required>
                  <input
                    type="text"
                    placeholder="번개부동산"
                    value={form.companyName}
                    onChange={update("companyName")}
                    className={`base-input ${meta.ring}`}
                  />
                </Field>
                <Field label="사업자등록번호" required>
                  <input
                    type="text"
                    placeholder="000-00-00000"
                    value={form.businessNumber}
                    onChange={update("businessNumber")}
                    className={`base-input ${meta.ring}`}
                  />
                </Field>
                <p className="text-[11px] text-amber-700/80">
                  ※ 가입 후 관리자 승인이 완료되어야 매물을 등록할 수 있어요.
                </p>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-slate-50/50">
              <label className="flex items-center gap-2 cursor-pointer select-none font-bold text-slate-800">
                <input
                  type="checkbox"
                  checked={agreeAll}
                  onChange={(e) => toggleAll(e.target.checked)}
                  className="w-4 h-4 accent-slate-800"
                />
                모두 동의
              </label>
              <div className="h-px bg-slate-200 my-1" />
              <Agree
                label="서비스 이용약관 동의"
                required
                checked={agree.tos}
                onChange={(v) => toggleOne("tos", v)}
              />
              <Agree
                label="개인정보 수집·이용 동의"
                required
                checked={agree.privacy}
                onChange={(v) => toggleOne("privacy", v)}
              />
              <Agree
                label="마케팅 정보 수신 동의 (선택)"
                checked={agree.marketing}
                onChange={(v) => toggleOne("marketing", v)}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className={`btn-base w-full h-12 bg-gradient-to-r ${meta.accent}`}
            >
              {loading ? "가입 중..." : `${meta.label} 회원가입`}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          이미 계정이 있으신가요?{" "}
          <Link href="/auth/login" className="font-bold text-slate-800 hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
    </div>
  );
}

function Agree({
  label,
  required,
  checked,
  onChange,
}: {
  label: string;
  required?: boolean;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-slate-800"
      />
      <span>
        {required && <span className="text-rose-500 mr-0.5">[필수]</span>}
        {label}
      </span>
    </label>
  );
}
