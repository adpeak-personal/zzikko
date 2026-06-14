// =====================================================================
// 게시글 단일 데이터 소스 (mock)
// ---------------------------------------------------------------------
// 목록(getBoardPosts)과 상세(getPost)가 "같은 배열"을 본다.
// 그래서 목록에서 클릭한 글과 상세 페이지의 내용이 항상 일치한다.
//
// DB 설계(zzikko_structure.sql)의 통합 posts 구조를 그대로 본떴다.
//   - boardSlug : navigation.ts 의 카테고리 slug 로 게시판 구분
//   - deal      : 핫딜 게시판 전용 확장 필드 (= extra_data JSON)
//
// 실제 API 연동 시 이 파일의 getBoardPosts / getPost 두 함수만
// fetch 호출로 교체하면 화면 코드는 그대로 동작한다.
// =====================================================================

export type Author = {
  nickname: string;
  level: string;
  profileImage: string;
};

/** 핫딜 게시판 전용 확장 필드 (posts.extra_data) */
export type Deal = {
  mall: string;
  price: number;
  originalPrice: number;
  discountRate: number;
  freeShipping: boolean;
  isEnded: boolean;
  endsAt: string;
  dealUrl: string;
};

export type Reply = {
  id: number;
  author: string;
  profileImage: string;
  content: string;
  likeCount: number;
  daysAgo: number;
};

export type Comment = {
  id: number;
  author: string;
  profileImage: string;
  content: string;
  likeCount: number;
  daysAgo: number;
  replies: Reply[];
};

export type Post = {
  id: number; // 전역 고유 id
  boardSlug: string;
  title: string;
  author: Author;
  createdAt: string;
  daysAgo: number;
  views: number;
  likeCount: number;
  commentCount: number;
  isHot: boolean;
  isNew: boolean;
  thumb: string | null;
  rating?: number; // reviews 전용
  content: string[];
  images: string[];
  tags: string[];
  deal?: Deal; // hotdeal 전용
  comments: Comment[];
};

const SAMPLE_THUMBS = [
  "/job_default_image.jpg",
  "/alt_image.jpg",
  "/profile-base.png",
  "/logo.png",
];

const PROFILE = "/profile-base.png";

/** daysAgo 만큼 과거 시각 문자열 생성 (기준: 2026.06.14 14:22, 결정적) */
function fmtDate(daysAgo: number): string {
  const base = new Date(2026, 5, 14, 14, 22); // 월은 0-index
  base.setDate(base.getDate() - daysAgo);
  base.setMinutes(base.getMinutes() - ((daysAgo * 7) % 60));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}.${p(base.getMonth() + 1)}.${p(
    base.getDate()
  )} ${p(base.getHours())}:${p(base.getMinutes())}`;
}

/** 기준일(2026.06.14)에서 days 일 뒤 날짜 (YYYY.MM.DD) — 핫딜 마감일용 */
function fmtFutureDate(days: number): string {
  const base = new Date(2026, 5, 14);
  base.setDate(base.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}.${p(base.getMonth() + 1)}.${p(base.getDate())}`;
}

function levelOf(seed: number): string {
  return ["BRONZE", "SILVER", "GOLD", "PLATINUM"][seed % 4];
}

// ---------------------------------------------------------------------
// 댓글 생성 (id 로 결정적 — 새로고침해도 동일)
// ---------------------------------------------------------------------
const COMMENT_BODIES = [
  "오 정보 감사합니다! 바로 확인해볼게요.",
  "이거 계속 찾고 있었는데 딱이네요 ㅎㅎ",
  "혹시 추가 할인도 같이 되나요? 결제창에서 안 보여서요.",
  "역시 믿고 보는 정보 ㅋㅋ 감사합니다.",
  "방금 다녀왔는데 글이랑 똑같았어요. 강추!",
  "공유 감사합니다, 도움 정말 많이 됐어요.",
];
const COMMENT_NICKS = [
  "알뜰소비러",
  "지름신강림",
  "눈팅만3년",
  "폰고수",
  "현금완납러",
  "통신요정",
];

function buildComments(post: { id: number; commentCount: number }): Comment[] {
  const n = Math.min(post.commentCount, 3);
  const out: Comment[] = [];
  for (let j = 0; j < n; j++) {
    const seed = post.id * 7 + j;
    const comment: Comment = {
      id: post.id * 100 + j + 1,
      author: COMMENT_NICKS[seed % COMMENT_NICKS.length],
      profileImage: PROFILE,
      content: COMMENT_BODIES[seed % COMMENT_BODIES.length],
      likeCount: (seed * 3) % 15,
      daysAgo: j === 0 ? 0 : j,
      replies:
        j === 0 && post.commentCount > 5
          ? [
              {
                id: post.id * 100 + 90,
                author: post.id.toString(), // placeholder, 작성자 닉네임으로 치환됨
                profileImage: PROFILE,
                content: "확인 감사합니다! 도움 되셨다니 다행이에요 👍",
                likeCount: (seed * 2) % 8,
                daysAgo: 0,
              },
            ]
          : [],
    };
    out.push(comment);
  }
  return out;
}

// ---------------------------------------------------------------------
// 게시판별 본문/태그
// ---------------------------------------------------------------------
const CONTENT: Record<string, string[]> = {
  offline: [
    "오늘 직접 방문해서 확인하고 온 좌표 공유합니다. 현장 분위기도 친절하고 대기 없이 바로 상담 받았어요.",
    "조건은 번호이동 기준이고, 기기변경도 가능하다고 하니 방문 전에 전화로 한 번 더 확인하시는 걸 추천드려요.",
    "현금완납으로 진행했고 부가서비스 강요 없이 깔끔했습니다. 필요하신 분들 빠르게 다녀오세요!",
  ],
  online: [
    "온라인 비대면으로 진행한 시세 공유합니다. 전국 어디서나 택배 개통 가능해서 편했어요.",
    "톡상담으로 견적 받고 그대로 진행했습니다. 추가 비용이나 숨은 조건 없는지 꼼꼼히 확인하세요.",
    "당일 개통까지 깔끔하게 끝났습니다. 자세한 조건은 댓글로 문의 주세요!",
  ],
  "internet-tv": [
    "이번에 인터넷+TV 결합으로 받은 현금 사은품 후기입니다. 설치 기사님도 친절하셨어요.",
    "약정 기간이랑 위약금 조건은 가입 전에 반드시 확인하세요. 사은품 지급 시점도 미리 물어보는 게 좋습니다.",
    "기존보다 월 요금도 줄고 사은품까지 받아서 만족스럽습니다.",
  ],
  reviews: [
    "직접 다녀온 솔직 후기입니다. 사진은 실제로 받은 견적서예요.",
    "상담받을 때 들었던 조건이랑 실제 개통 조건이 동일했습니다. 과장 없이 진행돼서 좋았어요.",
    "고민하시는 분들께 도움 되길 바라며 공유합니다. 궁금한 점은 댓글 남겨주세요!",
  ],
  tips: [
    "성지 다니면서 호갱 안 당하려고 정리한 꿀팁입니다.",
    "할부원금, 공시지원금, 선택약정 개념만 알아도 호구 잡힐 일이 확 줄어듭니다. 꼭 숙지하세요.",
    "표나 사진은 참고용이고, 가장 중요한 건 '현금완납 영수증' 챙기는 겁니다!",
  ],
  hotdeal: [
    "오늘 뜬 핫딜 공유합니다. 그동안 잘 안 내려오던 가격인데 추가 할인까지 들어가서 역대급이네요.",
    "재고 많지 않은 것 같으니 필요하신 분들 빠르게 확인해보세요. 카드 청구할인 중복 적용되는지는 결제창에서 한 번 더 확인하시는 걸 추천드려요.",
    "배송도 빠른 편이고 품질도 만족스럽습니다. 좋은 정보 되셨으면 좋겠어요!",
  ],
};

const TAGS: Record<string, string[]> = {
  offline: ["성지", "오프라인", "좌표공유", "현금완납"],
  online: ["온라인성지", "비대면", "택배개통", "자급제"],
  "internet-tv": ["인터넷", "TV결합", "현금사은품", "약정"],
  reviews: ["후기", "실구매", "성지", "리얼리뷰"],
  tips: ["꿀팁", "호갱탈출", "통신상식", "절약"],
  hotdeal: ["핫딜", "특가", "골드박스", "무료배송"],
};

// ---------------------------------------------------------------------
// 게시판별 글 생성기 (각 카테고리 페이지의 기존 목록 공식 그대로 재현)
// ---------------------------------------------------------------------
function thumbAt(i: number, mod: number, off: number): string | null {
  return i % mod !== off ? SAMPLE_THUMBS[i % SAMPLE_THUMBS.length] : null;
}

type RawPost = Omit<Post, "author" | "createdAt" | "content" | "images" | "tags" | "comments"> & {
  authorNick: string;
};

function generateBoard(slug: string): RawPost[] {
  switch (slug) {
    case "offline":
      return Array.from({ length: 15 }).map((_, i) => ({
        id: 0,
        boardSlug: slug,
        title: `[${["강남", "홍대", "건대", "잠실", "수원"][i % 5]}] 휴대폰 성지 좌표 공유 #${i + 1}`,
        authorNick: ["성지헌터", "동네성지", "현장방문", "좌표공유", "성지러"][i % 5],
        daysAgo: i,
        views: 200 + ((i * 167) % 6000),
        likeCount: 10 + ((i * 13) % 90),
        commentCount: (i * 9) % 50,
        isHot: i % 4 === 0,
        isNew: i < 3,
        thumb: thumbAt(i, 3, 2),
      }));
    case "online":
      return Array.from({ length: 15 }).map((_, i) => ({
        id: 0,
        boardSlug: slug,
        title: `[온라인 성지] 갤럭시 S24 자급제급 가격 ${i + 1}호점`,
        authorNick: ["온라인공구", "전국비대면", "당일개통", "온라인장인", "톡상담"][i % 5],
        daysAgo: i,
        views: 200 + ((i * 211) % 7000),
        likeCount: 10 + ((i * 17) % 90),
        commentCount: (i * 11) % 47,
        isHot: i % 4 === 0,
        isNew: i < 3,
        thumb: thumbAt(i, 3, 2),
      }));
    case "internet-tv":
      return Array.from({ length: 15 }).map((_, i) => ({
        id: 0,
        boardSlug: slug,
        title: `[${["KT", "SKB", "LG U+", "결합", "알뜰"][i % 5]}] 인터넷+TV 현금 사은품 ${30 + i * 2}만원`,
        authorNick: ["인터넷장인", "결합왕", "기가매니아", "사은품킹", "TV박사"][i % 5],
        daysAgo: i,
        views: 300 + ((i * 179) % 5500),
        likeCount: 10 + ((i * 19) % 90),
        commentCount: (i * 11) % 45,
        isHot: i % 4 === 0,
        isNew: i < 3,
        thumb: thumbAt(i, 3, 2),
      }));
    case "reviews":
      return Array.from({ length: 15 }).map((_, i) => ({
        id: 0,
        boardSlug: slug,
        title: `${["강남", "홍대", "건대", "잠실", "수원"][i % 5]} 성지 다녀온 후기 — S24 ${i + 1}만원`,
        authorNick: ["리뷰어A", "솔직후기", "구매자B", "체험단", "직접가본"][i % 5],
        daysAgo: i,
        views: 300 + ((i * 173) % 8000),
        likeCount: 10 + ((i * 23) % 90),
        commentCount: (i * 13) % 60,
        isHot: i % 4 === 0,
        isNew: i < 3,
        thumb: thumbAt(i, 3, 2),
        rating: 3.5 + ((i * 3) % 15) / 10, // 3.5 ~ 4.9
      }));
    case "tips":
      return Array.from({ length: 15 }).map((_, i) => ({
        id: 0,
        boardSlug: slug,
        title: `[꿀팁] 호갱 안 되는 성지 가는 법 #${i + 1}`,
        authorNick: ["꿀팁장인", "성지마스터", "절약왕", "통신박사", "현금왕"][i % 5],
        daysAgo: i,
        views: 100 + ((i * 137) % 5000),
        likeCount: 10 + ((i * 29) % 90),
        commentCount: (i * 7) % 53,
        isHot: i % 5 === 0,
        isNew: i < 3,
        thumb: thumbAt(i, 3, 2),
      }));
    case "hotdeal": {
      const MALLS = ["쿠팡", "11번가", "G마켓", "네이버", "옥션", "위메프"];
      const TITLES = [
        "삼성 갤럭시 버즈3 프로 (실구매가 역대최저)",
        "애플워치 SE 2세대 40mm GPS 특가",
        "다이슨 에어랩 컴플리트 롱 + 사은품",
        "LG 27인치 4K 모니터 카드할인 추가",
        "나이키 에어포스1 화이트 전사이즈",
      ];
      return Array.from({ length: 18 }).map((_, i) => {
        const price = 9900 + ((i * 7300) % 120000);
        const discountRate = 15 + ((i * 11) % 60);
        const originalPrice = Math.round(price / (1 - discountRate / 100));
        const isEnded = i % 6 === 0;
        const freeShipping = i % 3 !== 0;
        return {
          id: 0,
          boardSlug: slug,
          title: TITLES[i % 5],
          authorNick: ["김철수", "이영희", "박민준", "최서연", "정도윤"][i % 5],
          daysAgo: i,
          views: 100 + ((i * 137) % 5000),
          likeCount: 10 + ((i * 31) % 120),
          commentCount: (i * 5) % 87,
          isHot: i % 5 === 0,
          isNew: i < 3,
          thumb: i % 4 !== 3 ? SAMPLE_THUMBS[i % SAMPLE_THUMBS.length] : null,
          deal: {
            mall: MALLS[i % MALLS.length],
            price,
            originalPrice,
            discountRate,
            freeShipping,
            isEnded,
            endsAt: fmtFutureDate(3 + (i % 10)),
            dealUrl: "https://www.coupang.com",
          },
        };
      });
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------
// 전역 글 목록 — 게시판을 가로질러 id 를 고유하게 부여
// ---------------------------------------------------------------------
const BOARD_ORDER = ["offline", "online", "internet-tv", "reviews", "hotdeal", "tips"];

function hydrate(raw: RawPost): Post {
  const author: Author = {
    nickname: raw.authorNick,
    level: levelOf(raw.id),
    profileImage: PROFILE,
  };
  const comments = buildComments(raw).map((c) => ({
    ...c,
    // 작성자 본인이 단 답글의 닉네임을 실제 작성자로 치환
    replies: c.replies.map((r) => ({ ...r, author: raw.authorNick })),
  }));
  const images = raw.thumb
    ? raw.boardSlug === "hotdeal"
      ? [raw.thumb, SAMPLE_THUMBS[(raw.id + 1) % SAMPLE_THUMBS.length]]
      : [raw.thumb]
    : [];
  return {
    id: raw.id,
    boardSlug: raw.boardSlug,
    title: raw.title,
    author,
    createdAt: fmtDate(raw.daysAgo),
    daysAgo: raw.daysAgo,
    views: raw.views,
    likeCount: raw.likeCount,
    commentCount: raw.commentCount,
    isHot: raw.isHot,
    isNew: raw.isNew,
    thumb: raw.thumb,
    rating: raw.rating,
    content: CONTENT[raw.boardSlug] ?? CONTENT.tips,
    images,
    tags: TAGS[raw.boardSlug] ?? [],
    deal: raw.deal,
    comments,
  };
}

let _idSeq = 1;
const ALL_POSTS: Post[] = BOARD_ORDER.flatMap((slug) =>
  generateBoard(slug).map((raw) => hydrate({ ...raw, id: _idSeq++ }))
);

// ---------------------------------------------------------------------
// 공개 API (실제 백엔드 연동 시 이 두 함수만 fetch 로 교체)
// ---------------------------------------------------------------------

/** 게시판(slug) 의 글 목록 (상세 모델 전체) */
export function getBoardPosts(slug: string): Post[] {
  return ALL_POSTS.filter((p) => p.boardSlug === slug);
}

/** BoardList 컴포넌트가 쓰는 가벼운 목록 행 타입 */
export type BoardRow = {
  id: number;
  title: string;
  author: string;
  comments: number;
  views: number;
  isHot?: boolean;
  isNew?: boolean;
  daysAgo: number;
  thumb?: string | null;
  rating?: number;
};

/** 게시판(slug) 의 글 목록을 BoardList 행 형태로 반환 */
export function getBoardRows(slug: string): BoardRow[] {
  return getBoardPosts(slug).map((p) => ({
    id: p.id,
    title: p.title,
    author: p.author.nickname,
    comments: p.commentCount,
    views: p.views,
    isHot: p.isHot,
    isNew: p.isNew,
    daysAgo: p.daysAgo,
    thumb: p.thumb,
    rating: p.rating,
  }));
}

/** id 로 글 1건 조회 (없으면 undefined) */
export function getPost(id: number): Post | undefined {
  return ALL_POSTS.find((p) => p.id === id);
}

/** 이전/다음 글 id (같은 게시판 내, 없으면 null) */
export function getAdjacent(id: number): { prevId: number | null; nextId: number | null } {
  const post = getPost(id);
  if (!post) return { prevId: null, nextId: null };
  const board = getBoardPosts(post.boardSlug);
  const idx = board.findIndex((p) => p.id === id);
  return {
    prevId: idx > 0 ? board[idx - 1].id : null,
    nextId: idx >= 0 && idx < board.length - 1 ? board[idx + 1].id : null,
  };
}
