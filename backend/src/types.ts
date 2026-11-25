// API 가 주고받는 도메인 타입 — frontend/src/types/index.ts 와 같은 형태를 유지할 것.
// DB 컬럼은 snake_case, 여기서부터는 camelCase 로 바꿔서 내보낸다 (변환은 repositories 안에서).

export type Carrier = 'SKT' | 'KT' | 'LG U+' | '알뜰폰';
export type JoinType = '번호이동' | '기기변경' | '신규가입';
export type Region = '서울' | '경기·인천' | '부산' | '대구' | '대전' | '광주' | '강원' | '제주';

export type MemberLevel = '새싹' | '눈팅러' | '단골' | '고수' | '성지지기' | '운영진';
export type MemberRole = '회원' | '판매자' | '운영진';

export type BoardType = 'list' | 'deal' | 'gallery' | 'news' | 'spec' | 'plan';
export type WriteMode = 'editor' | 'photo';
export type ChipTier = '플래그십' | '준플래그십' | '중급' | '보급형';

/** 비밀번호·이메일을 뺀 공개용 회원 정보 */
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
  /** 카카오로 가입했으면 null */
  email: string | null;
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
  /** 운영진만 글을 쓸 수 있다 (공지사항 등) */
  adminOnly?: boolean;
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
  /** 저장 정본 — ProseMirror JSON */
  contentJson: unknown | null;
  /** 목록 미리보기·검색용 평문 */
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

/** 기사·기종에 붙는 사진. **순서가 곧 노출 순서다.** */
export interface ContentImage {
  url: string;
  caption: string;
}

export interface NewsArticle {
  id: number;
  title: string;
  category: string;
  summary: string;
  body: string;
  thumb: string;
  images: ContentImage[];
  /** 읽기 전용 — images[0] 에서 따 둔 값이다. 저장할 땐 images 만 보낸다 */
  thumbUrl: string | null;
  author: string;
  date: string;
  featured: boolean;
  published: boolean;  /** 출처 표기가 이용 조건이라 비워두지 않는다 (직접 쓴 글이면 null) */
  sourceName?: string | null;
  sourceUrl?: string | null;
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
  images: ContentImage[];
  /** 읽기 전용 — images[0] 에서 따 둔 값이다. 저장할 땐 images 만 보낸다 */
  thumbUrl: string | null;
  published: boolean;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/* ── 네이버 작업 계정 (nwork) — 어드민 전용 ── */

export interface NworkAccount {
  id: number;
  /** 네이버 아이디 */
  loginId: string;
  /** 메모1 — 보통 이름 / 생년 / 이메일 */
  memo1: string;
  /** 메모2 — 최근 작업 기록 (예: "25-11-12 작업 완료") */
  memo2: string;
  memo3: string;
  /** 'YYYY-MM-DD HH:MM:SS' */
  lastLoginCheckAt: string | null;
  lastWorkAt: string | null;
  /** 로그인 가능한 계정인지 (막히면 false) */
  usable: boolean;
  /** 용도 — 미사용 · 밴드 · 블로그준비 · 블로그 … */
  role: string;
  /** 지금 어떤 프로그램이 쓰고 있는지 */
  working: boolean;
  userAgentId: number | null;
  profile: string | null;
}

export interface NworkSummary {
  total: number;
  usable: number;
  working: number;
  roles: { role: string; count: number }[];
  /** 용도가 비어 있는 계정 수 */
  noRole: number;
}

/* ── 판매자 입점 신청 ── */

export type SellerApplicationStatus = '신청' | '연락중' | '승인' | '보류';

export interface SellerApplication {
  id: number;
  shopName: string;
  manager: string;
  /** 숫자만 — 화면에서 010-0000-0000 으로 다시 끊어 보여준다 */
  phone: string;
  region: string;
  area: string | null;
  carriers: string[];
  /** 지금 조건을 올리는 곳 — 카톡 · 밴드 · 뽐뿌 … */
  channel: string | null;
  message: string | null;
  status: SellerApplicationStatus;
  /** 운영진 메모 — 신청자에게 보이지 않는다 */
  memo: string | null;
  createdAt: string;
}

/* ── 시세 리포트 (SEO·GEO) ───────────────────────────────────────────
 * 사이트 게시판(posts)과 분리된 콘텐츠다. /sise 목록과 상세에만 나온다.
 */

/** 시세표의 한 칸. price 단위는 만원이고 음수는 페이백이다 (-23 = 23만원 페이백). */
export interface SiseRow {
  series: string;
  model: string;
  storage: string;
  carrier: Carrier;
  plan: string;
  joinType: JoinType;
  price: number;
}

/** 이미지에서 막 읽어낸 상태 — 사람이 확인한 뒤 저장한다 */
export interface SiseSheetDraft {
  note: string;
  rows: SiseRow[];
}

export interface SiseSheet extends SiseSheetDraft {
  id: number;
  /**
   * 시세 지역. **회원·매장의 `Region` 과 다르다** — 이쪽은 '수원'·'부천'처럼 시 단위까지
   * 자유롭게 들어온다. 검색량이 받쳐주는 지역으로 글을 쓰기 때문이다("경기"는 거의 안 찾는다).
   */
  region: string;
  /** 시세 기준일 (YYYY-MM-DD) */
  datedOn: string;
  imageUrl: string;
  createdAt: string;
}

/** 직전 시세표와 견준 결과. delta 가 음수면 싸졌다는 뜻이다. */
export interface SiseChange {
  model: string;
  storage: string;
  carrier: Carrier;
  joinType: JoinType;
  before: number;
  after: number;
  delta: number;
}

/** AI 가 쓰는 건 해설뿐이다 — 표는 rows 로 화면에서 그린다 */
export interface SiseSections {
  lead: string;
  /**
   * 소제목이 붙은 본문 덩어리. 소제목은 글쓴이가 직접 정한다.
   *
   * 예전에는 `highlights: string[]`(한 줄짜리 목록)이었다. 블로그처럼 읽히는 글이
   * 목적이라 문단으로 바꿨다 — 옛 글은 `repositories/sise.ts` 가 읽을 때 변환한다.
   */
  blocks: { heading: string; body: string }[];
  closing: string;
}

export interface SiseReport {
  id: number;
  slug: string;
  title: string;
  summary: string;
  sections: SiseSections;
  changes: SiseChange[];
  published: boolean;
  publishedAt: string | null;
  views: number;
  createdAt: string;
  updatedAt: string;
  sheet: SiseSheet;
  /** 견준 직전 시세표의 기준일. 첫 글이면 null */
  comparedTo: string | null;
}

/* ── 뉴스 수집함 ─────────────────────────────────────────────────── */

/** '삭제'는 행을 지우는 게 아니라 목록에서 빼는 상태다 — guid 가 남아야 다시 안 받는다 */
export type NewsFeedStatus = '수집' | '작성됨' | '숨김' | '삭제';

/** RSS 로 받아 둔 원문 항목. 사람이 고른 것만 기사가 된다. */
export interface NewsFeedItem {
  id: number;
  /** 한국어로 옮긴 제목이 있으면 그것, 없으면 원문 */
  title: string;
  /** 옮긴 제목을 쓰고 있을 때의 원문. 안 옮겼으면 null */
  titleOriginal: string | null;
  link: string;
  publishedAt: string;
  sourceName: string;
  /** 원문 앞부분 — 고를 때 보라고 주는 것 */
  preview: string;
  status: NewsFeedStatus;
  articleId: number | null;
}

/** 유심 요금제 — 바깥 목록에서 받아 온다(`mvno_plans`). 요금은 원 단위 */
export interface MvnoPlan {
  id: number;
  /** 파는 곳 (SKT · 더원모바일 …) */
  carrier: string;
  /** 망 (SKT · KT · LG U+) */
  network: string;
  /** LTE · 5G (모르면 빈 값) */
  tech: string;
  name: string;
  tags: string[];
  /** 화면용 문장 ("11GB+일2") — 비교는 아래 숫자로 한다 */
  dataText: string;
  dataGb: number | null;
  dailyGb: number | null;
  unlimited: boolean;
  /** 다 쓴 뒤 속도 또는 테더링 등 데이터 보조 문장 */
  afterSpeed: string;
  voice: string;
  sms: string;
  /** 지금 내는 월 요금(할인 기간 중이면 할인가). 포인트는 빼지 않은 값이다 */
  monthlyFee: number;
  promoMonths: number | null;
  feeAfterPromo: number | null;
  regularFee: number | null;
  /** 포인트·사은품 문장 */
  benefit: string;
  perks: string[];
  conditions: string[];
  /** 가입 안내 페이지(원문) */
  sourceUrl: string;
  /** 마지막으로 목록에서 확인한 시각 */
  updatedAt: string;
}

export interface PlanList {
  items: MvnoPlan[];
  source: { name: string; home: string };
  syncedAt: string | null;
}

/* ── 블로그 작업 프로필 (IP ↔ 크롬 프로필 한 쌍) ── */

/** 어드민 화면용. **프록시 비밀번호는 담지 않는다** */
export interface BlogProfile {
  id: number;
  /** 크롬 프로필 폴더 이름이자 `nwork.work_profile` 과 묶는 키 */
  name: string;
  proxyHost: string;
  proxyPort: number | null;
  proxyUser: string;
  hasProxyPass: boolean;
  userAgent: string;
  note: string;
  /** 이 프로필일 때 밖에서 보여야 할 IP. 다르면 작업기가 로그인하지 않고 멈춘다 */
  expectedIp: string;
  /** VPN 에서 고를 위치 이름 (자동 전환에 쓴다) */
  vpnLocation: string;
  active: boolean;
  /** 지우기로 표시해 둔 것. 작업기가 PC 의 폴더를 지운 뒤 행을 없앤다 */
  pendingDelete: boolean;
  /** 이 프로필로 마지막에 로그인이 통한 시각 */
  lastOkAt: string | null;
  /** 이 프로필에 붙은 계정. **하나만 붙이는 게 원칙**이다 */
  accounts: BlogProfileAccount[];
}

/** 프로필에 붙은 계정 한 줄 (목록 화면용 — 비밀번호 없음) */
export interface BlogProfileAccount {
  id: number;
  loginId: string;
  /** 쓸 수 있다고 표시돼 있는지. 꺼져 있으면 작업에서 빠진다 */
  usable: boolean;
  lastLoginCheckAt: string | null;
}

/** 작업기(py)에게만 주는 계정 — 비밀번호가 들어 있다 */
export interface RunnerAccount {
  id: number;
  loginId: string;
  password: string;
  lastLoginCheckAt: string | null;
}

/** 작업기(py)에게만 주는 프로필 — 프록시 비밀번호가 들어 있다 */
export interface RunnerProfile {
  id: number;
  name: string;
  proxyHost: string;
  proxyPort: number | null;
  proxyUser: string;
  proxyPass: string;
  userAgent: string;
  expectedIp: string;
  vpnLocation: string;
  accounts: RunnerAccount[];
}
