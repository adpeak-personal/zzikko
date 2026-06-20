export type HotdealExtra = {
  mall: string;
  price: number;
  original_price: number;
  discount_rate: number;
  free_shipping: boolean;
  is_ended: boolean;
  ends_at: string;
  deal_url: string;
};

export type PostRow = {
  id: number;
  board_slug: string;
  title: string;
  thumb: string | null;
  views: number;
  like_count: number;
  comment_count: number;
  is_notice: number;
  extra_data: HotdealExtra | null;
  created_at: string;
  author: string;
  level: string;
};

export type PostListMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PostListResponse = {
  data: PostRow[];
  meta: PostListMeta;
};

export type CommentRow = {
  id: number;
  parent_id: number | null;
  content: string;
  like_count: number;
  created_at: string;
  author: string;
  author_profile_image: string | null;
};

export type NestedComment = CommentRow & { replies: NestedComment[] };

export type PostDetail = {
  id: number;
  board_slug: string;
  title: string;
  content: string;
  thumbnail_url: string | null;
  extra_data: HotdealExtra | Record<string, unknown> | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  is_notice: number;
  created_at: string;
  author: string;
  author_profile_image: string | null;
  level: string;
  comments: CommentRow[];
  prev_id: number | null;
  next_id: number | null;
};
