export interface BulkBlogJobItem {
  title: string;
  scheduled_at: string; // ISO
  keywords?: string[];
}

export interface BulkSaveBlogJobsInput {
  items: BulkBlogJobItem[];
}

export interface BulkSaveBlogJobsResponse {
  saved: number;
  skipped: number;
  skipped_titles: string[];
  inserted_ids: number[];
  dedupe_window_days: number;
}

// ─── 목록/삭제 ──────────────────────────────────────────────
export type BlogJobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface BlogJob {
  id: number;
  title: string;
  keywords: string | null;        // 콤마구분 문자열
  scheduled_at: string;           // 'YYYY-MM-DD HH:MM:SS'
  status: BlogJobStatus;
  result_url: string | null;
  error: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogJobListResponse {
  items: BlogJob[];
  total: number;
  page: number;
  limit: number;
  counts: Record<BlogJobStatus, number>;
}

export interface DeleteBlogJobsByQuery {
  status?: BlogJobStatus;
  all?: boolean;
}
