export interface BoardSub {
  id: number;
  board_slug: string;
  slug: string;
  title: string;
  icon: string | null;
  hidden_from_nav: number; // 0 | 1
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface BoardSubListResponse {
  items: BoardSub[];
}

export interface CreateBoardSubInput {
  board_slug: string;
  slug: string;
  title: string;
  icon?: string | null;
  hidden_from_nav?: 0 | 1 | boolean;
  sort_order?: number;
}

export interface UpdateBoardSubInput {
  id: number;
  title?: string;
  icon?: string | null;
  hidden_from_nav?: 0 | 1 | boolean;
  sort_order?: number;
}

export interface ReorderBoardSubsInput {
  items: Array<{ id: number; sort_order: number }>;
}
