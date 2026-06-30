"use client";

import { useBlogJobs } from "@/service/blog-jobs/queries";
import {
  useDeleteBlogJob,
  useDeleteBlogJobsByQuery,
} from "@/service/blog-jobs/mutations";
import type { BlogJob, BlogJobStatus } from "@/service/blog-jobs/types";

const STATUS_META: Record<BlogJobStatus, { label: string; cls: string; dot: string }> = {
  PENDING: { label: "대기", cls: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  PROCESSING: { label: "진행중", cls: "bg-blue-50 text-blue-600", dot: "bg-blue-500 animate-pulse" },
  DONE: { label: "완료", cls: "bg-green-50 text-green-600", dot: "bg-green-500" },
  FAILED: { label: "실패", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
};

function formatSchedule(dt: string): string {
  // 'YYYY-MM-DD HH:MM:SS' → 'MM/DD(요일) HH:MM'
  // 백엔드 connection 이 KST 라 그대로 파싱해도 KST 로 해석됨
  const d = new Date(dt.replace(" ", "T"));
  const pad = (n: number) => String(n).padStart(2, "0");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}(${days[d.getDay()]}) ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function splitKeywords(csv: string | null): string[] {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

export default function JobBoard() {
  const { data, isPending, isError, refetch } = useBlogJobs({ limit: 100 });
  const removeMut = useDeleteBlogJob();
  const bulkDeleteMut = useDeleteBlogJobsByQuery();

  if (isPending) {
    return <div className="py-20 text-center text-slate-400 text-sm">불러오는 중…</div>;
  }
  if (isError) {
    return (
      <div className="py-20 text-center text-sm text-red-500">
        예약 목록을 불러오지 못했습니다.{" "}
        <button onClick={() => refetch()} className="underline ml-2">다시 시도</button>
      </div>
    );
  }

  const jobs: BlogJob[] = data?.items ?? [];
  const counts = data?.counts ?? { PENDING: 0, PROCESSING: 0, DONE: 0, FAILED: 0 };

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-4xl">🗓️</p>
        <p className="text-sm font-bold text-slate-500">예약된 작업이 없습니다.</p>
        <p className="text-xs text-slate-400">{`'새 예약 만들기'에서 제목·키워드를 등록해 보세요.`}</p>
      </div>
    );
  }

  async function handleRemove(id: number) {
    if (!confirm("이 예약을 삭제할까요?")) return;
    await removeMut.mutateAsync(id);
  }

  async function handleClearDone() {
    if (counts.DONE === 0) return;
    if (!confirm(`완료된 작업 ${counts.DONE}건을 삭제할까요?`)) return;
    await bulkDeleteMut.mutateAsync({ status: "DONE" });
  }

  async function handleClearAll() {
    if (!confirm(`모든 예약 ${data?.total ?? 0}건을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    await bulkDeleteMut.mutateAsync({ all: true });
  }

  return (
    <div className="space-y-5">
      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {(["PENDING", "PROCESSING", "DONE", "FAILED"] as BlogJobStatus[]).map((s) => (
          <div key={s} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${STATUS_META[s].dot}`} />
              <span className="text-xs font-bold text-slate-500">{STATUS_META[s].label}</span>
            </div>
            <div className="mt-1 text-2xl font-black text-slate-900 tabular-nums">
              {counts[s] ?? 0}
            </div>
          </div>
        ))}
      </div>

      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => refetch()}
          className="text-xs font-bold text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg border border-slate-200"
        >
          🔄 새로고침
        </button>
        <div className="flex-1" />
        <button
          onClick={handleClearDone}
          disabled={counts.DONE === 0 || bulkDeleteMut.isPending}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 disabled:opacity-40 px-3 py-2 rounded-lg border border-slate-200"
        >
          완료 정리 ({counts.DONE})
        </button>
        <button
          onClick={handleClearAll}
          disabled={bulkDeleteMut.isPending}
          className="text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-40 px-3 py-2 rounded-lg border border-red-200"
        >
          전체 삭제
        </button>
      </div>

      {/* 작업 목록 */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-bold">발행 시각</th>
                <th className="px-4 py-3 font-bold">제목</th>
                <th className="px-4 py-3 font-bold hidden md:table-cell">키워드</th>
                <th className="px-4 py-3 font-bold">상태</th>
                <th className="px-4 py-3 font-bold w-12" />
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const kws = splitKeywords(job.keywords);
                return (
                  <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap tabular-nums">
                      {formatSchedule(job.scheduled_at)}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {job.status === "DONE" && job.result_url ? (
                        <a
                          href={job.result_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {job.title}
                        </a>
                      ) : (
                        job.title
                      )}
                      {job.status === "FAILED" && job.error && (
                        <div className="mt-0.5 text-[11px] text-red-500 line-clamp-2">
                          {job.error}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {kws.map((kw) => (
                          <span
                            key={kw}
                            className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-md ${STATUS_META[job.status].cls}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_META[job.status].dot}`} />
                        {STATUS_META[job.status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRemove(job.id)}
                        disabled={removeMut.isPending}
                        className="text-slate-300 hover:text-red-500 disabled:opacity-40"
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
