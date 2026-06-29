export type KeywordCategory = "region" | "phone_model";

export interface Keyword {
  id: number;
  category: KeywordCategory;
  name: string;
  sort_order: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface KeywordListResponse {
  items: Keyword[];
}

export interface BulkCreateKeywordsInput {
  category: KeywordCategory;
  names: string[];
}

export interface BulkCreateKeywordsResponse {
  requested: number;
  inserted: number;
  items: Keyword[];
}

export interface BulkDeleteKeywordsInput {
  ids: number[];
}

export interface BulkDeleteKeywordsResponse {
  deleted: number;
}

export const KEYWORD_CATEGORY_LABEL: Record<KeywordCategory, string> = {
  region: "지역",
  phone_model: "기종",
};
