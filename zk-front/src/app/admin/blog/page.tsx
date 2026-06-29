"use client";

import { useState } from "react";
import BulkComposer from "@/components/admin/blog/BulkComposer";
import JobBoard from "@/components/admin/blog/JobBoard";
import { useBlogJobsStore } from "@/store/blogJobs";
import { useHydrated } from "@/lib/useHydrated";

type Tab = "compose" | "board";

export default function AdminBlogPage() {
  const [tab, setTab] = useState<Tab>("compose");
  const hydrated = useHydrated();
  const count = useBlogJobsStore((s) => s.jobs.length);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">블로그 예약 발행</h1>
        <p className="mt-1 text-sm text-slate-500">
          제목·키워드를 한 번에 넣으면 설정한 시간 동안 자동으로 분배됩니다. 파이썬 워커가 시각에
          맞춰 글을 생성·업로드합니다.
        </p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("compose")}
          className={`text-sm font-bold px-4 py-2 rounded-lg transition-colors ${
            tab === "compose" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
          }`}
        >
          새 예약 만들기
        </button>
        <button
          onClick={() => setTab("board")}
          className={`text-sm font-bold px-4 py-2 rounded-lg transition-colors ${
            tab === "board" ? "bg-white shadow-sm text-slate-900" : "text-slate-500"
          }`}
        >
          예약 현황{hydrated && count > 0 ? ` (${count})` : ""}
        </button>
      </div>

      {tab === "compose" ? (
        <BulkComposer onRegistered={() => setTab("board")} />
      ) : (
        <JobBoard />
      )}

      {/* 연동 안내 */}
      <details className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm text-slate-600">
        <summary className="font-bold text-slate-700 cursor-pointer">
          🐍 파이썬 워커 연동 방법 (백엔드 준비되면)
        </summary>
        <div className="mt-3 space-y-2 leading-relaxed">
          <p>워커는 1분마다 폴링하며, 발행 시각이 된 작업을 가져가 처리합니다.</p>
          <pre className="bg-slate-900 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto">{`GET   /api/admin/blog-jobs/due      # scheduled_at<=now & PENDING 1건
PATCH /api/admin/blog-jobs/{id}     # {status:"PROCESSING"} 로 선점
  -> generate_it_post(title, keywords)   # keywords: 콤마로 받은 여러 키워드
  -> build_blog_html(...)  ->  upload
PATCH /api/admin/blog-jobs/{id}     # {status:"DONE", result_url} / {status:"FAILED", error}`}</pre>
          <p className="text-xs text-slate-400">
            {`현재는 데모용으로 브라우저(localStorage)에 저장됩니다. '다음 작업 완료처리' 버튼으로 워커 동작을 흉내 낼 수 있어요.`}
          </p>
        </div>
      </details>
    </div>
  );
}
