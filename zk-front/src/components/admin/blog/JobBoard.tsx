"use client";

import { useBlogJobsStore } from "@/store/blogJobs";
import { useHydrated } from "@/lib/useHydrated";
import { formatSchedule, type BlogJobStatus } from "@/lib/blog-schedule";

const STATUS_META: Record<BlogJobStatus, { label: string; cls: string; dot: string }> = {
  PENDING: { label: "대기", cls: "bg-slate-100 text-slate-500", dot: "bg-slate-400" },
  PROCESSING: { label: "진행중", cls: "bg-blue-50 text-blue-600", dot: "bg-blue-500 animate-pulse" },
  DONE: { label: "완료", cls: "bg-green-50 text-green-600", dot: "bg-green-500" },
  FAILED: { label: "실패", cls: "bg-red-50 text-red-600", dot: "bg-red-500" },
};

export default function JobBoard() {
  const hydrated = useHydrated();
  const jobs = useBlogJobsStore((s) => s.jobs);
  const removeJob = useBlogJobsStore((s) => s.removeJob);
  const clearDone = useBlogJobsStore((s) => s.clearDone);
  const clearAll = useBlogJobsStore((s) => s.clearAll);
  const advanceDemo = useBlogJobsStore((s) => s.advanceDemo);

  if (!hydrated) {
    return <div className="py-20 text-center text-slate-400 text-sm">불러오는 중…</div>;
  }

  const counts = jobs.reduce(
    (acc, j) => ({ ...acc, [j.status]: (acc[j.status] ?? 0) + 1 }),
    {} as Record<BlogJobStatus, number>,
  );

  if (jobs.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-4xl">🗓️</p>
        <p className="text-sm font-bold text-slate-500">예약된 작업이 없습니다.</p>
        <p className="text-xs text-slate-400">{`'새 예약 만들기'에서 제목·키워드를 등록해 보세요.`}</p>
      </div>
    );
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
          onClick={advanceDemo}
          className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded-lg transition-colors"
          title="발행 시각이 지난 대기 작업 1건을 완료 처리(워커 동작 시뮬레이션)"
        >
          ▶ 다음 작업 완료처리 (데모)
        </button>
        <div className="flex-1" />
        <button
          onClick={clearDone}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-2 rounded-lg border border-slate-200"
        >
          완료 정리
        </button>
        <button
          onClick={() => {
            if (confirm("모든 예약을 삭제할까요?")) clearAll();
          }}
          className="text-xs font-bold text-red-500 hover:text-red-600 px-3 py-2 rounded-lg border border-red-200"
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
              {jobs.map((job) => (
                <tr key={job.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap tabular-nums">
                    {formatSchedule(job.scheduledAt)}
                  </td>
                  <td className="px-4 py-3 text-slate-800">{job.title}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(job.keywords ?? []).map((kw) => (
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
                      onClick={() => removeJob(job.id)}
                      className="text-slate-300 hover:text-red-500"
                      aria-label="삭제"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
