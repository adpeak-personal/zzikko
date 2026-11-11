// 초기 데이터 넣기 — `npm run db:seed`
// 스키마(src/db/schema.sql)를 적용한 뒤에 실행한다. 여러 번 돌려도 되도록 기존 데이터를 비우고 넣는다.
// 모두 예시 데이터이며 실제 매장·시세·사양이 아니다.
import { loadEnv } from './env.mjs';

loadEnv();
import { createPool } from 'mysql2/promise';
import { randomBytes, scrypt as scryptCb } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** 데모 계정 공통 비밀번호 */
const DEMO_PASSWORD = 'zzikko1234';

const BOARD_GROUPS = [
  {
    name: '📢 공지 & 안내',
    boards: [
      { slug: 'notice', name: '공지사항', description: '찍고 운영 소식', type: 'list' },
      { slug: 'greeting', name: '가입인사', description: '반갑습니다! 인사 남겨주세요', type: 'list' },
    ],
  },
  {
    name: '📱 휴대폰',
    boards: [
      {
        slug: 'deals',
        name: '성지 시세표',
        description: '지역별 판매자가 올리는 오늘의 가입 조건',
        type: 'list',
        categories: ['서울', '경기·인천', '부산', '대구', '대전', '광주', '강원', '제주'],
        sellerOnly: 1,
      },
      { slug: 'news', name: 'IT 소식', description: '신제품과 통신사 소식', type: 'news' },
      { slug: 'specs', name: '스펙 비교', description: '기종별 사양을 나란히 비교', type: 'spec' },
    ],
  },
  {
    name: '💬 커뮤니티',
    boards: [
      { slug: 'qna', name: '질문·답변', description: '조건이 괜찮은지 물어보세요', type: 'list', categories: ['가입조건', '요금제', '기기선택', '기타'] },
      { slug: 'review', name: '이용 후기', description: '다녀온 매장의 솔직한 후기', type: 'list', categories: ['좋았어요', '아쉬웠어요', '주의'] },
      { slug: 'free', name: '자유게시판', description: '휴대폰·통신 사는 이야기', type: 'list' },
    ],
  },
  {
    name: '🛒 장터 & 생활',
    boards: [
      { slug: 'market', name: '중고장터', description: '공기계·액세서리 직거래', type: 'gallery', writeMode: 'photo', categories: ['공기계', '액세서리', '나눔'] },
      { slug: 'internet', name: '인터넷·결합', description: '인터넷 가입과 결합 할인 정보', type: 'list', categories: ['신규', '재약정', '결합'] },
    ],
  },
];

const USERS = [
  { email: 'admin@zzikko.test', nickname: '찍고 운영팀', level: '운영진', role: '운영진', region: '서울', color: '#111827' },
  { email: 'me@zzikko.test', nickname: '폰바꾸는날', level: '단골', role: '회원', region: '서울', color: '#fa6038', bio: '3년마다 기기 바꾸는 평범한 직장인' },
  { email: 'gangnam@zzikko.test', nickname: '강남 모바일', level: '성지지기', role: '판매자', region: '서울', color: '#2f6f5e' },
  { email: 'suwon@zzikko.test', nickname: '동네폰 수원점', level: '성지지기', role: '판매자', region: '경기·인천', color: '#1f6feb' },
  { email: 'bupyeong@zzikko.test', nickname: '부평 폰이웃', level: '성지지기', role: '판매자', region: '경기·인천', color: '#7b5ea7' },
  { email: 'seomyeon@zzikko.test', nickname: '서면 스마트샵', level: '성지지기', role: '판매자', region: '부산', color: '#c2410c' },
  { email: 'green@zzikko.test', nickname: '초록집', level: '고수', role: '회원', region: '경기·인천', color: '#0f766e' },
  { email: 'walk@zzikko.test', nickname: '모바일산책', level: '단골', role: '회원', region: '서울', color: '#b45309' },
  { email: 'slow@zzikko.test', nickname: '느린오후', level: '눈팅러', role: '회원', region: '대전', color: '#6d28d9' },
  { email: 'bear@zzikko.test', nickname: '꼼꼼한곰', level: '고수', role: '회원', region: '경기·인천', color: '#0369a1' },
  { email: 'incheon@zzikko.test', nickname: '인천딸', level: '새싹', role: '회원', region: '경기·인천', color: '#be123c' },
  { email: 'bare@zzikko.test', nickname: '맨손파', level: '단골', role: '회원', region: '부산', color: '#4d7c0f' },
];

const SHOPS = [
  { slug: 'gangnam-mobile', name: '강남 모바일', region: '서울', area: '서울 강남구', owner: '강남 모바일', intro: '가입 조건부터 차근차근 알려드립니다.', rating: 4.8, reviews: 214, verified: 1 },
  { slug: 'suwon-dongne', name: '동네폰 수원점', region: '경기·인천', area: '경기 수원시', owner: '동네폰 수원점', intro: '우리 가족 통신비, 같이 계산해 드려요.', rating: 4.6, reviews: 158, verified: 1 },
  { slug: 'bupyeong-phone', name: '부평 폰이웃', region: '경기·인천', area: '인천 부평구', owner: '부평 폰이웃', intro: '기기변경과 번호이동을 알기 쉽게.', rating: 4.5, reviews: 96, verified: 1 },
  { slug: 'busan-seomyeon', name: '서면 스마트샵', region: '부산', area: '부산 진구', owner: '서면 스마트샵', intro: '부산·경남 지역 가입 상담.', rating: 4.4, reviews: 72, verified: 0 },
];

/** 평문을 에디터 본문(ProseMirror JSON)으로 */
const doc = (text) => ({
  type: 'doc',
  content: text.split('\n').map((line) => (line.trim() ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' })),
});

const POSTS = [
  { board: 'notice', author: '찍고 운영팀', notice: 1, title: '[필독] 찍고 커뮤니티 이용 규칙 (2026 개정판)', body: '판매자와 회원 모두가 지켜야 할 기본 규칙입니다.\n\n1. 시세 글에는 할부원금, 요금제와 유지 기간, 부가서비스 조건을 반드시 함께 적어주세요.\n2. 후기는 실제 이용 경험만 작성해 주세요.\n3. 개인 연락처를 글 본문에 남기지 말아주세요.', views: 15230, likes: 412, hours: 72 },
  { board: 'notice', author: '찍고 운영팀', notice: 1, title: '[공지] 시세표 판매자 인증 절차가 바뀝니다', body: '사업자등록증과 사전승낙서 확인 후 인증 배지를 드립니다.', views: 8421, likes: 156, hours: 120 },

  { board: 'deals', author: '강남 모바일', category: '서울', region: '서울', title: '[강남] 갤럭시 S26 256G 번호이동 조건 정리했습니다', body: '가입 조건 예시입니다. 실제 판매 조건이 아닙니다.\n\n요금제 6개월 유지 기준이며 부가서비스 2종 3개월 유지 조건이 포함되어 있습니다. 방문 전 재고를 먼저 확인해 주세요.', views: 1284, likes: 63, hours: 1, deal: { shop: 'gangnam-mobile', model: '갤럭시 S26', storage: '256GB', carrier: 'SKT', joinType: '번호이동', principal: 190000, plan: '5G 프리미어 89,000원', planMonths: 6, addons: ['부가서비스 2종 3개월'] } },
  { board: 'deals', author: '강남 모바일', category: '서울', region: '서울', title: '[강남] 아이폰 17 256G 조건 안내드립니다', body: '아이폰 17 번호이동 조건 예시입니다. 요금제 유지 기간과 부가서비스를 꼭 확인해 주세요.', views: 2103, likes: 98, hours: 3, deal: { shop: 'gangnam-mobile', model: '아이폰 17', storage: '256GB', carrier: 'KT', joinType: '번호이동', principal: 340000, plan: '5G 초이스 프리미엄 90,000원', planMonths: 6, addons: ['부가서비스 1종 3개월'] } },
  { board: 'deals', author: '강남 모바일', category: '서울', region: '서울', title: '[강남] 기기변경 고객님 조건도 따로 준비했어요', body: '기기변경은 번호이동과 조건이 다를 수 있습니다. 현재 요금제와 약정 만료일을 알려주시면 계산해 드립니다.', views: 876, likes: 31, hours: 20, deal: { shop: 'gangnam-mobile', model: '갤럭시 Z 플립8', storage: '256GB', carrier: 'SKT', joinType: '기기변경', principal: 560000, plan: '5G 프리미어 95,000원', planMonths: 6, addons: [] } },
  { board: 'deals', author: '동네폰 수원점', category: '경기·인천', region: '경기·인천', title: '[수원] 주말 방문 예약 조건표 미리 보내드립니다', body: '수원·동탄 지역 조건 예시입니다. 방문 전에 현재 요금제와 약정 만료일을 알려주세요.', views: 964, likes: 44, hours: 2, deal: { shop: 'suwon-dongne', model: '갤럭시 S26', storage: '256GB', carrier: 'LG U+', joinType: '번호이동', principal: 150000, plan: '5G 프리미어 레귤러 85,000원', planMonths: 6, addons: ['부가서비스 2종 3개월'] } },
  { board: 'deals', author: '부평 폰이웃', category: '경기·인천', region: '경기·인천', title: '[부평] 아이폰 17e 신규가입 조건입니다', body: '알뜰폰에서 이동하시는 분들 문의가 많아 따로 정리했습니다.', views: 612, likes: 22, hours: 16, deal: { shop: 'bupyeong-phone', model: '아이폰 17e', storage: '128GB', carrier: 'KT', joinType: '신규가입', principal: 90000, plan: '5G 슬림 61,000원', planMonths: 4, addons: [] } },
  { board: 'deals', author: '부평 폰이웃', category: '경기·인천', region: '경기·인천', title: '[부평] 갤럭시 S26 울트라 기기변경 조건', body: '울트라 모델은 재고가 자주 바뀝니다. 방문 전 연락 주세요.', views: 723, likes: 28, hours: 46, deal: { shop: 'bupyeong-phone', model: '갤럭시 S26 울트라', storage: '512GB', carrier: 'SKT', joinType: '기기변경', principal: 820000, plan: '5G 프리미어 플러스 105,000원', planMonths: 6, addons: ['부가서비스 1종 3개월'] } },
  { board: 'deals', author: '서면 스마트샵', category: '부산', region: '부산', title: '[서면] 이번 주 번호이동 조건 안내드립니다', body: '부산·경남 지역 조건 예시입니다.', views: 534, likes: 19, hours: 4, deal: { shop: 'busan-seomyeon', model: '아이폰 17 Pro', storage: '256GB', carrier: 'KT', joinType: '번호이동', principal: 690000, plan: '5G 초이스 프리미엄 90,000원', planMonths: 6, addons: ['부가서비스 2종 3개월'] } },
  { board: 'deals', author: '서면 스마트샵', category: '부산', region: '부산', title: '[서면] 갤럭시 Z 플립8 폴더블 조건', body: '폴더블은 보험·케이스 등 부가 조건이 붙는 경우가 많으니 항목별로 확인해 주세요.', views: 418, likes: 15, hours: 50, deal: { shop: 'busan-seomyeon', model: '갤럭시 Z 플립8', storage: '256GB', carrier: 'LG U+', joinType: '번호이동', principal: 430000, plan: '5G 프리미어 레귤러 85,000원', planMonths: 6, addons: [] } },

  { board: 'qna', author: '폰바꾸는날', category: '가입조건', region: '서울', title: '번호이동이랑 기기변경, 조건 비교할 때 뭘 봐야 하나요?', body: '같은 기종인데 매장마다 설명이 달라서 헷갈립니다. 어떤 항목을 나란히 비교해야 할까요?', views: 342, likes: 12, hours: 2 },
  { board: 'qna', author: '인천딸', category: '요금제', title: '요금제 6개월 유지 조건, 중간에 내리면 어떻게 되나요?', body: '유지 기간 전에 요금제를 낮추면 위약금이 생긴다고 들었는데 정확히 어떻게 계산되는지 궁금합니다.', views: 289, likes: 8, hours: 5 },
  { board: 'qna', author: '인천딸', category: '기기선택', title: '부모님 휴대폰, 효도폰 말고 일반 기종 추천받고 싶어요', body: '글씨 크기와 카메라, 배터리를 주로 보십니다. 어떤 기종이 좋을까요?', views: 476, likes: 21, hours: 18 },
  { board: 'qna', author: '초록집', category: '가입조건', title: '인터넷 약정 끝났는데 재약정이랑 이동 중 뭐가 나을까요?', body: '현재 500메가 쓰고 있고 결합은 휴대폰 2회선입니다.', views: 531, likes: 18, hours: 22 },

  { board: 'review', author: '꼼꼼한곰', category: '좋았어요', region: '서울', title: '견적서 받아서 집에서 다시 계산해봤어요', body: '현장에서 바로 결정하지 않고 견적서를 받아와 약정 기간 전체 비용을 계산해보니 비교가 훨씬 쉬웠습니다.\n\n후기 형식의 데모 게시글이며 실제 이용 경험이 아닙니다.', views: 1203, likes: 87, hours: 6 },
  { board: 'review', author: '모바일산책', category: '좋았어요', region: '서울', title: '방문 전에 준비하면 좋은 것들 공유해요', body: '기존 약정 만료일과 월 요금을 확인하고, 조건이 적힌 견적서를 받아 전체 비용을 비교해보세요.', views: 894, likes: 56, hours: 28 },
  { board: 'review', author: '맨손파', category: '주의', title: '부가서비스 해지일 꼭 달력에 적어두세요', body: '3개월 유지 조건이었는데 깜빡하고 넘어가서 한 달치를 더 냈습니다. 데모 게시글입니다.', views: 1520, likes: 134, hours: 44 },

  { board: 'free', author: '느린오후', title: '다들 휴대폰 몇 년 정도 쓰고 바꾸시나요?', body: '배터리, 카메라, 새로운 기능 중 어떤 이유로 교체하시는지 궁금해요.', views: 812, likes: 34, hours: 8 },
  { board: 'free', author: '맨손파', title: '케이스 없이 쓰시는 분 계신가요?', body: '그립감 때문에 케이스를 안 쓰는 분들 이야기가 궁금합니다.', views: 1043, likes: 41, hours: 30 },
  { board: 'free', author: '초록집', title: '통신사 멤버십 혜택 잘 쓰고 계신가요?', body: '영화관 할인 정도만 쓰는데 다른 분들은 어떻게 활용하시는지 궁금해요.', views: 576, likes: 22, hours: 52 },

  { board: 'market', author: '느린오후', category: '공기계', title: '갤럭시 S25 공기계 팝니다 (미사용)', body: '개통만 하고 사용하지 않은 공기계입니다. 직거래 선호합니다.', views: 332, likes: 6, hours: 3 },
  { board: 'market', author: '인천딸', category: '나눔', title: '아이폰 정품 케이스 새것 나눔합니다', body: '기종이 바뀌어서 나눔합니다.', views: 287, likes: 19, hours: 26 },
  { board: 'market', author: '맨손파', category: '액세서리', title: '보조배터리 두 개 정리합니다', body: '사용감 있지만 동작에는 문제 없습니다.', views: 241, likes: 5, hours: 48 },
  { board: 'market', author: '모바일산책', category: '공기계', title: '아이폰 16 공기계 (배터리 성능 92%)', body: '예비폰으로 쓰던 기기입니다.', views: 398, likes: 11, hours: 70 },

  { board: 'internet', author: '꼼꼼한곰', category: '결합', title: '휴대폰 3회선 + 인터넷 결합하면 얼마나 줄어드나요?', body: '가족 결합을 고민 중입니다. 실제로 얼마나 차이가 나는지 궁금해요.', views: 445, likes: 17, hours: 7 },
  { board: 'internet', author: '초록집', category: '재약정', title: '인터넷 재약정 상담받을 때 확인할 것들', body: '설치비, 장비 임대료, 결합 해지 시 요금까지 견적에 넣어 비교하세요.', views: 692, likes: 38, hours: 54 },

  { board: 'greeting', author: '인천딸', title: '가입했습니다! 잘 부탁드려요', body: '첫 스마트폰 교체를 앞두고 가입했습니다.', views: 88, likes: 14, hours: 4 },
  { board: 'greeting', author: '느린오후', title: '눈팅만 하다가 인사 드립니다', body: '정보 많이 얻어갑니다. 감사합니다.', views: 102, likes: 9, hours: 34 },
];

const COMMENTS = [
  { postTitle: '번호이동이랑 기기변경, 조건 비교할 때 뭘 봐야 하나요?', author: '강남 모바일', content: '할부원금, 요금제 유지 기간, 부가서비스 조건 세 가지를 같은 표에 놓고 비교하시면 편합니다.', likes: 24 },
  { postTitle: '번호이동이랑 기기변경, 조건 비교할 때 뭘 봐야 하나요?', author: '꼼꼼한곰', content: '저는 약정 기간 전체 통신비를 계산해봤어요. 기기값만 보면 놓치는 게 많더라고요.', likes: 16 },
  { postTitle: '번호이동이랑 기기변경, 조건 비교할 때 뭘 봐야 하나요?', author: '폰바꾸는날', content: '두 분 다 감사합니다! 견적서 받아서 비교해볼게요.', likes: 3 },
  { postTitle: '[강남] 갤럭시 S26 256G 번호이동 조건 정리했습니다', author: '폰바꾸는날', content: '재고 문의드립니다. 블루 색상도 같은 조건인가요?', likes: 2 },
  { postTitle: '[강남] 갤럭시 S26 256G 번호이동 조건 정리했습니다', author: '강남 모바일', content: '네, 색상 관계없이 동일합니다. 다만 재고는 매일 달라져서 방문 전에 확인 부탁드려요.', likes: 7 },
];

const CHIPSETS = [
  { name: 'Snapdragon 8 Gen 5', maker: 'Qualcomm', tier: '플래그십', year: 2025 },
  { name: 'A19', maker: 'Apple', tier: '플래그십', year: 2026 },
  { name: 'A19 Pro', maker: 'Apple', tier: '플래그십', year: 2026 },
  { name: 'A18', maker: 'Apple', tier: '준플래그십', year: 2025 },
  { name: 'Exynos 2600', maker: 'Samsung', tier: '준플래그십', year: 2026 },
  { name: 'Dimensity 8400', maker: 'MediaTek', tier: '중급', year: 2025 },
];

const SPECS = [
  { name: '갤럭시 S26', brand: 'Samsung', releaseDate: '2026-02', retailPrice: 1155000, chipset: 'Snapdragon 8 Gen 5', display: '6.2형 AMOLED · 120Hz', storage: '256GB / 512GB', battery: '4000mAh', charging: '유선 25W · 무선 15W', cameraMain: '5000만 화소 (광각)', cameraFront: '1200만 화소', weight: '167g', displayInch: 6.2, refreshHz: 120, memoryGb: 8, batteryMah: 4000, chargingWatt: 25, cameraMainMp: 5000, weightG: 167, thumb: 'violet' },
  { name: '갤럭시 S26 울트라', brand: 'Samsung', releaseDate: '2026-02', retailPrice: 1798000, chipset: 'Snapdragon 8 Gen 5', display: '6.9형 AMOLED · 120Hz', storage: '256GB / 512GB / 1TB', battery: '5000mAh', charging: '유선 45W · 무선 15W', cameraMain: '2억 화소 (광각)', cameraFront: '1200만 화소', weight: '218g', displayInch: 6.9, refreshHz: 120, memoryGb: 12, batteryMah: 5000, chargingWatt: 45, cameraMainMp: 20000, weightG: 218, thumb: 'indigo' },
  { name: '아이폰 17', brand: 'Apple', releaseDate: '2026-09', retailPrice: 1250000, chipset: 'A19', display: '6.3형 OLED · 120Hz', storage: '256GB / 512GB', battery: '3600mAh', charging: '유선 30W · 무선 25W', cameraMain: '4800만 화소 (광각)', cameraFront: '1800만 화소', weight: '177g', displayInch: 6.3, refreshHz: 120, memoryGb: 8, batteryMah: 3600, chargingWatt: 30, cameraMainMp: 4800, weightG: 177, thumb: 'slate' },
  { name: '아이폰 17 Pro', brand: 'Apple', releaseDate: '2026-09', retailPrice: 1550000, chipset: 'A19 Pro', display: '6.3형 OLED · 120Hz', storage: '256GB / 512GB / 1TB', battery: '3900mAh', charging: '유선 35W · 무선 25W', cameraMain: '4800만 화소 (광각·망원·초광각)', cameraFront: '1800만 화소', weight: '199g', displayInch: 6.3, refreshHz: 120, memoryGb: 12, batteryMah: 3900, chargingWatt: 35, cameraMainMp: 4800, weightG: 199, thumb: 'amber' },
  { name: '갤럭시 Z 플립8', brand: 'Samsung', releaseDate: '2026-07', retailPrice: 1398000, chipset: 'Snapdragon 8 Gen 5', display: '6.7형 폴더블 AMOLED · 120Hz', storage: '256GB / 512GB', battery: '4300mAh', charging: '유선 25W · 무선 15W', cameraMain: '5000만 화소 (광각)', cameraFront: '1000만 화소', weight: '188g', displayInch: 6.7, refreshHz: 120, memoryGb: 12, batteryMah: 4300, chargingWatt: 25, cameraMainMp: 5000, weightG: 188, thumb: 'rose' },
  { name: '아이폰 17e', brand: 'Apple', releaseDate: '2026-05', retailPrice: 890000, chipset: 'A18', display: '6.1형 OLED · 60Hz', storage: '128GB / 256GB', battery: '3400mAh', charging: '유선 20W · 무선 15W', cameraMain: '4800만 화소 (광각)', cameraFront: '1200만 화소', weight: '170g', displayInch: 6.1, refreshHz: 60, memoryGb: 8, batteryMah: 3400, chargingWatt: 20, cameraMainMp: 4800, weightG: 170, thumb: 'teal' },
];

const NEWS = [
  { title: '갤럭시 S26 시리즈 국내 출시 일정 정리', category: '신제품', summary: '사전예약 기간과 개통 시작일은 통신사별로 다를 수 있습니다. 예약 혜택과 함께 정리했습니다.', body: '제조사 발표를 기준으로 정리한 예시 글입니다.\n\n사전예약은 보통 개통 시작 일주일 전에 열리고, 예약 혜택은 통신사와 판매처에 따라 다릅니다.', thumb: 'violet', author: '찍고 편집팀', days: 0, featured: 1, published: 1 },
  { title: '5G 중간 요금제, 뭐가 달라졌나요?', category: '요금제', summary: '데이터 구간이 세분화되면서 선택지가 늘었습니다. 본인 사용량부터 확인하세요.', body: '예시 글입니다.', thumb: 'teal', author: '초록집', days: 1, featured: 0, published: 1 },
  { title: '통신사 멤버십 개편 소식', category: '통신사', summary: '영화·카페 제휴 할인이 정리되고 데이터 선물 한도가 바뀝니다.', body: '예시 글입니다. 실제 공지가 아닙니다.', thumb: 'amber', author: '모바일산책', days: 2, featured: 0, published: 1 },
  { title: '아이폰 17 시리즈, 국내 판매 첫 주 분위기', category: '신제품', summary: 'Pro 모델에 수요가 몰리면서 색상별 재고 편차가 큰 편입니다.', body: '예시 글입니다.', thumb: 'slate', author: '찍고 편집팀', days: 3, featured: 0, published: 1 },
  { title: '알뜰폰 요금제, 어떤 경우에 유리한가요?', category: '요금제', summary: '통화·데이터가 적고 결합이 없다면 비교해볼 만합니다.', body: '예시 글입니다.', thumb: 'indigo', author: '꼼꼼한곰', days: 4, featured: 0, published: 1 },
  { title: '(임시저장) 통신 3사 위약금 제도 비교', category: '통신사', summary: '아직 작성 중인 글입니다 — 발행을 끄면 사이트에 안 보입니다.', body: '작성 중.', thumb: 'rose', author: '찍고 편집팀', days: 5, featured: 0, published: 0 },
];

const ago = (hours) => new Date(Date.now() - hours * 3600_000);
const daysAgo = (days) => new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);

const main = async () => {
  const pool = createPool({ uri: process.env.DATABASE_URL, charset: 'utf8mb4', dateStrings: true, timezone: '+09:00' });
  const conn = await pool.getConnection();

  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of ['uploads', 'phone_specs', 'chipsets', 'news_articles', 'post_likes', 'comments', 'post_deals', 'posts', 'boards', 'board_groups', 'shops', 'users']) {
      await conn.query(`TRUNCATE TABLE ${table}`);
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    // 회원
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    const userId = {};
    for (const user of USERS) {
      const [result] = await conn.execute(
        'INSERT INTO users (email, password_hash, nickname, avatar_color, level, role, region, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [user.email, passwordHash, user.nickname, user.color, user.level, user.role, user.region, user.bio ?? null],
      );
      userId[user.nickname] = result.insertId;
    }

    // 매장 + 판매자 연결
    const shopId = {};
    for (const shop of SHOPS) {
      const [result] = await conn.execute(
        'INSERT INTO shops (slug, name, region, area, owner_id, intro, rating, review_count, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [shop.slug, shop.name, shop.region, shop.area, userId[shop.owner], shop.intro, shop.rating, shop.reviews, shop.verified],
      );
      shopId[shop.slug] = result.insertId;
      await conn.execute('UPDATE users SET shop_id = ? WHERE id = ?', [result.insertId, userId[shop.owner]]);
    }

    // 게시판
    const boardId = {};
    let groupOrder = 0;
    for (const group of BOARD_GROUPS) {
      const [g] = await conn.execute('INSERT INTO board_groups (name, sort_order) VALUES (?, ?)', [group.name, groupOrder++]);
      let boardOrder = 0;
      for (const board of group.boards) {
        const [b] = await conn.execute(
          'INSERT INTO boards (group_id, slug, name, description, type, write_mode, categories, seller_only, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [g.insertId, board.slug, board.name, board.description, board.type, board.writeMode ?? 'editor', board.categories ? JSON.stringify(board.categories) : null, board.sellerOnly ?? 0, boardOrder++],
        );
        boardId[board.slug] = b.insertId;
      }
    }

    // 게시글 + 시세 조건
    const postId = {};
    for (const post of POSTS) {
      const body = doc(post.body);
      const [result] = await conn.execute(
        'INSERT INTO posts (board_id, author_id, category, region, title, content_json, content_text, is_notice, views, likes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [boardId[post.board], userId[post.author], post.category ?? null, post.region ?? null, post.title, JSON.stringify(body), post.body, post.notice ?? 0, post.views, post.likes, ago(post.hours)],
      );
      postId[post.title] = result.insertId;

      if (post.deal) {
        const d = post.deal;
        await conn.execute(
          'INSERT INTO post_deals (post_id, shop_id, model, storage, carrier, join_type, principal, plan, plan_months, addons) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [result.insertId, shopId[d.shop], d.model, d.storage, d.carrier, d.joinType, d.principal, d.plan, d.planMonths, JSON.stringify(d.addons)],
        );
      }
    }

    // 댓글 (글의 comment_count 도 같이 올린다)
    for (const comment of COMMENTS) {
      await conn.execute('INSERT INTO comments (post_id, author_id, content, likes) VALUES (?, ?, ?, ?)', [
        postId[comment.postTitle],
        userId[comment.author],
        comment.content,
        comment.likes,
      ]);
      await conn.execute('UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?', [postId[comment.postTitle]]);
    }

    // 칩셋 → 기종 사양
    const chipsetId = {};
    for (const chipset of CHIPSETS) {
      const [result] = await conn.execute('INSERT INTO chipsets (name, maker, tier, year) VALUES (?, ?, ?, ?)', [chipset.name, chipset.maker, chipset.tier, chipset.year]);
      chipsetId[chipset.name] = result.insertId;
    }
    for (const spec of SPECS) {
      await conn.execute(
        `INSERT INTO phone_specs (name, brand, release_date, retail_price, chipset_id, display, storage, battery, charging,
           camera_main, camera_front, weight, display_inch, refresh_hz, memory_gb, battery_mah, charging_watt, camera_main_mp, weight_g, thumb)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [spec.name, spec.brand, spec.releaseDate, spec.retailPrice, chipsetId[spec.chipset], spec.display, spec.storage, spec.battery, spec.charging,
         spec.cameraMain, spec.cameraFront, spec.weight, spec.displayInch, spec.refreshHz, spec.memoryGb, spec.batteryMah, spec.chargingWatt, spec.cameraMainMp, spec.weightG, spec.thumb],
      );
    }

    // IT 소식
    for (const article of NEWS) {
      await conn.execute(
        'INSERT INTO news_articles (title, category, summary, body, thumb, author, date, featured, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [article.title, article.category, article.summary, article.body, article.thumb, article.author, daysAgo(article.days), article.featured, article.published],
      );
    }

    const [[counts]] = await conn.query(
      `SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM boards) AS boards,
              (SELECT COUNT(*) FROM posts) AS posts, (SELECT COUNT(*) FROM comments) AS comments,
              (SELECT COUNT(*) FROM shops) AS shops, (SELECT COUNT(*) FROM phone_specs) AS specs,
              (SELECT COUNT(*) FROM chipsets) AS chipsets, (SELECT COUNT(*) FROM news_articles) AS news`,
    );

    console.log('초기 데이터 입력 완료');
    console.table(counts);
    console.log(`\n데모 계정 비밀번호: ${DEMO_PASSWORD}`);
    console.log('  운영진  admin@zzikko.test');
    console.log('  회원    me@zzikko.test');
    console.log('  판매자  gangnam@zzikko.test');
  } finally {
    conn.release();
    await pool.end();
  }
};

await main();
