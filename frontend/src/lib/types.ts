// API 응답 타입 — backend/src/types.ts 와 같은 형태를 유지할 것.

export type Carrier = 'SKT' | 'KT' | 'LG U+' | '알뜰폰';
export type JoinType = '번호이동' | '기기변경' | '신규가입';
export type Region = '서울' | '경기·인천' | '부산' | '대구' | '대전' | '광주' | '강원' | '제주';

export type MemberLevel = '새싹' | '눈팅러' | '단골' | '고수' | '성지지기' | '운영진';
export type MemberRole = '회원' | '판매자' | '운영진';

/**
 * 게시판이 목록을 그리는 방식.
 * - list / deal / gallery : 회원이 쓴 글
 * - news / spec           : 어드민이 관리하는 콘텐츠
 */
export type BoardType = 'list' | 'deal' | 'gallery' | 'news' | 'spec';

/** 글 작성 화면 — 어느 쪽으로 써도 저장 형식은 같다 */
export type WriteMode = 'editor' | 'photo';

export type ChipTier = '플래그십' | '준플래그십' | '중급' | '보급형';

export interface PublicUser {
  id: number;
  nickname: string;
  avatarColor: string;
  level: MemberLevel;
  role: MemberRole;
  region: Region;
  shopId: number | null;
  bio: string | null;
  joinedAt: string;
}

export interface Me extends PublicUser {
  email: string;
}

export interface Board {
  id: number;
  slug: string;
  name: string;
  description: string;
  type: BoardType;
  writeMode: WriteMode;
  categories?: string[];
  sellerOnly?: boolean;
}

export interface BoardGroup {
  id: number;
  name: string;
  boards: Board[];
}

export interface DealInfo {
  model: string;
  storage: string;
  carrier: Carrier;
  joinType: JoinType;
  principal: number;
  plan: string;
  planMonths: number;
  addons: string[];
  shopId: number;
}

export interface Post {
  id: number;
  boardSlug: string;
  category: string | null;
  region: Region | null;
  title: string;
  /** 본문 정본 (ProseMirror JSON) */
  contentJson: unknown | null;
  /** 목록 미리보기용 평문 */
  content: string;
  thumbUrl: string | null;
  authorId: number;
  author?: PublicUser;
  isNotice: boolean;
  hasImage: boolean;
  views: number;
  likes: number;
  commentCount: number;
  createdAt: string;
  /** 로그인한 사람이 상세를 열었을 때만 채워진다 — 목록에는 없다 */
  liked?: boolean;
  scrapped?: boolean;
  deal?: DealInfo;
}

export interface Comment {
  id: number;
  postId: number;
  authorId: number;
  author?: PublicUser;
  parentId: number | null;
  content: string;
  likes: number;
  /** 로그인한 사람이 읽을 때만 채워진다 */
  liked?: boolean;
  createdAt: string;
}

export interface Shop {
  id: number;
  slug: string;
  name: string;
  region: Region;
  area: string;
  ownerId: number | null;
  intro: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
}

export interface NewsArticle {
  id: number;
  title: string;
  category: string;
  summary: string;
  body: string;
  thumb: string;
  thumbUrl: string | null;
  author: string;
  date: string;
  featured: boolean;
  published: boolean;
}

export interface Chipset {
  id: number;
  name: string;
  maker: string;
  tier: ChipTier;
  year: number;
}

export interface PhoneSpec {
  id: number;
  name: string;
  brand: 'Samsung' | 'Apple' | '기타';
  releaseDate: string;
  retailPrice: number;
  chipsetId: number | null;

  display: string;
  storage: string;
  battery: string;
  charging: string;
  cameraMain: string;
  cameraFront: string;
  weight: string;

  displayInch: number;
  refreshHz: number;
  memoryGb: number;
  batteryMah: number;
  chargingWatt: number;
  cameraMainMp: number;
  weightG: number;

  thumb: string;
  thumbUrl: string | null;
  published: boolean;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
