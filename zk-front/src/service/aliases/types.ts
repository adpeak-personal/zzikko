export interface Alias {
  id: number;
  user_id: number;
  nickname: string;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface AliasListResponse {
  items: Alias[];
}

export interface BulkCreateAliasesInput {
  user_id: number;
  nicknames: string[];
}

export interface BulkCreateAliasesResponse {
  requested: number;
  inserted: number;
  skipped: number;
  skipped_nicknames: string[];
}

export interface BulkDeleteAliasesInput {
  ids: number[];
}

export interface ToggleAliasInput {
  id: number;
  is_active: 0 | 1;
}
