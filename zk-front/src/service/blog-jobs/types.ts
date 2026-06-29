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
