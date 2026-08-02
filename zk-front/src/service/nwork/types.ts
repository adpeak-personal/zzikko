export interface NworkRow {
  n_idx: number;
  n_id: string;
  n_pwd: string;
  n_memo1: string | null;
  n_memo2: string | null;
  n_memo3: string | null;
  last_login_chk: string | null;
  n_lastwork_at: string | null;
  use_status: number;
  task_role: string;
  work_used: number;
  work_user_agent: number | null;
  work_profile: string | null;
}

export interface NworkListResponse {
  items: NworkRow[];
  total: number;
  page: number;
  limit: number;
  filters: {
    task_roles: string[];
  };
}

export type SortOrder = "asc" | "desc";

export interface NworkListParams {
  q?: string;
  page?: number;
  limit?: number;
  use_status?: "" | "0" | "1";
  task_role?: string;
  work_used?: "" | "0" | "1";
  sort?: string;
  order?: SortOrder;
}

export interface NworkUpdateInput {
  idx: number;
  patch: Partial<{
    n_id: string;
    n_pwd: string;
    n_memo1: string | null;
    n_memo2: string | null;
    n_memo3: string | null;
    use_status: 0 | 1;
    task_role: string;
    work_used: 0 | 1;
    work_user_agent: number | null;
    work_profile: string | null;
  }>;
}
