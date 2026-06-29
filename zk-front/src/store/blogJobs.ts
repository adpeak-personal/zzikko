import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BlogJob, BlogJobStatus } from "@/lib/blog-schedule";

interface NewJob {
  title: string;
  keywords: string[];
  scheduledAt: string; // ISO
}

interface BlogJobsState {
  jobs: BlogJob[];
  addJobs: (jobs: NewJob[]) => void;
  removeJob: (id: string) => void;
  clearDone: () => void;
  clearAll: () => void;
  setStatus: (id: string, status: BlogJobStatus, resultUrl?: string) => void;
  /** 데모용: 발행 시각이 지난 가장 이른 대기 작업을 완료 처리 */
  advanceDemo: () => void;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export const useBlogJobsStore = create<BlogJobsState>()(
  persist(
    (set) => ({
      jobs: [],

      addJobs: (newJobs) =>
        set((state) => ({
          jobs: [
            ...state.jobs,
            ...newJobs.map((j) => ({
              ...j,
              id: makeId(),
              status: "PENDING" as BlogJobStatus,
              createdAt: new Date().toISOString(),
            })),
          ].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)),
        })),

      removeJob: (id) =>
        set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) })),

      clearDone: () =>
        set((state) => ({
          jobs: state.jobs.filter((j) => j.status !== "DONE"),
        })),

      clearAll: () => set({ jobs: [] }),

      setStatus: (id, status, resultUrl) =>
        set((state) => ({
          jobs: state.jobs.map((j) =>
            j.id === id ? { ...j, status, resultUrl: resultUrl ?? j.resultUrl } : j,
          ),
        })),

      advanceDemo: () =>
        set((state) => {
          const now = Date.now();
          const target = state.jobs
            .filter((j) => j.status === "PENDING" && new Date(j.scheduledAt).getTime() <= now)
            .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0];
          if (!target) return state;
          return {
            jobs: state.jobs.map((j) =>
              j.id === target.id
                ? { ...j, status: "DONE", resultUrl: "#" }
                : j,
            ),
          };
        }),
    }),
    { name: "zzikko-blog-jobs" },
  ),
);
