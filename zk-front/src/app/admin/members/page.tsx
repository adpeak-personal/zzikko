"use client";

import { useState } from "react";
import { useMembers } from "@/service/members/queries";
import { useUpdateMember } from "@/service/members/mutations";
import type { Member, UserRole, UserStatus } from "@/service/members/types";

const ROLES: UserRole[] = ["BUYER", "SELLER", "ADMIN", "SUB_ADMIN"];
const STATUSES: UserStatus[] = ["ACTIVE", "INACTIVE", "BANNED", "DELETED"];

const STATUS_STYLE: Record<UserStatus, string> = {
  ACTIVE: "bg-green-50 text-green-600",
  INACTIVE: "bg-slate-100 text-slate-500",
  BANNED: "bg-red-50 text-red-600",
  DELETED: "bg-slate-100 text-slate-400",
};

function MemberRow({ member }: { member: Member }) {
  const { mutate, isPending } = useUpdateMember();

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50/60">
      <td className="px-4 py-3 text-slate-400 tabular-nums">{member.id}</td>
      <td className="px-4 py-3 font-bold text-slate-800">{member.nickname}</td>
      <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
        {member.email ?? "-"}
      </td>
      <td className="px-4 py-3">
        <select
          value={member.role}
          disabled={isPending}
          onChange={(e) => mutate({ id: member.id, role: e.target.value as UserRole })}
          className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1.5 bg-white disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={member.status}
          disabled={isPending}
          onChange={(e) => mutate({ id: member.id, status: e.target.value as UserStatus })}
          className={`text-xs font-bold rounded-lg px-2 py-1.5 border-0 disabled:opacity-50 ${
            STATUS_STYLE[member.status]
          }`}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3 text-slate-400 hidden lg:table-cell tabular-nums">
        {member.created_at?.slice(0, 10)}
      </td>
    </tr>
  );
}

export default function MembersPage() {
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useMembers(q, page);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQ(input.trim());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">회원관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            총 {data?.total ?? 0}명의 회원
          </p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="닉네임 · 이메일 검색"
            className="w-48 sm:w-64 text-sm border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-blue-400"
          />
          <button
            type="submit"
            className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl transition-colors"
          >
            검색
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-bold">ID</th>
                <th className="px-4 py-3 font-bold">닉네임</th>
                <th className="px-4 py-3 font-bold hidden md:table-cell">이메일</th>
                <th className="px-4 py-3 font-bold">권한</th>
                <th className="px-4 py-3 font-bold">상태</th>
                <th className="px-4 py-3 font-bold hidden lg:table-cell">가입일</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    불러오는 중…
                  </td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-red-500">
                    회원 목록을 불러오지 못했습니다.
                  </td>
                </tr>
              )}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    회원이 없습니다.
                  </td>
                </tr>
              )}
              {data?.items.map((member) => (
                <MemberRow key={member.id} member={member} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 페이지네이션 */}
      {data && data.total > data.limit && (
        <div className="flex items-center justify-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="text-sm font-bold px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
          >
            이전
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="text-sm font-bold px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
