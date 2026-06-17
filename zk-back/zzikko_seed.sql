-- =====================================================================
-- zzikko 샘플(시드) 데이터
--  - 개발/연결 테스트용. 실제 서비스 전 싹 비우고 시작할 것.
--  - 재실행 가능: 아래 TRUNCATE 로 초기화 후 id 1..N 으로 결정적 삽입.
--  - board_slug 는 zk-front/src/config/navigation.ts 의 CATEGORIES 기준:
--      핫딜=hotdeal / 휴대폰 성지=offline / 이용후기=reviews / 꿀팁게시판=tips
--  실행:  mysql -u root -p zzikko < zzikko_seed.sql
-- =====================================================================
USE `zzikko`;
SET NAMES utf8mb4;

-- ── 기존 데이터 초기화 (FK 무시하고 깨끗이) ─────────────────────────────
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `post_likes`;
TRUNCATE TABLE `comments`;
TRUNCATE TABLE `posts`;
TRUNCATE TABLE `user_profile`;
TRUNCATE TABLE `user_tokens`;
TRUNCATE TABLE `devices`;
TRUNCATE TABLE `users`;
SET FOREIGN_KEY_CHECKS = 1;


-- ── 유저 (작성자용) ───────────────────────────────────────────────────
INSERT INTO `users` (`id`, `email`, `password`, `nickname`, `sns`, `role`, `status`) VALUES
  (1, 'altteul@zzikko.local',  NULL, '알뜰소비왕',  'local', 'BUYER',  'ACTIVE'),
  (2, 'seongji@zzikko.local',  NULL, '성지순례러',  'local', 'BUYER',  'ACTIVE'),
  (3, 'escape@zzikko.local',   NULL, '호갱탈출',    'local', 'BUYER',  'ACTIVE'),
  (4, 'honeytip@zzikko.local', NULL, '꿀팁요정',    'local', 'SELLER', 'ACTIVE'),
  (5, 'admin@zzikko.local',    NULL, '찍고관리자',  'local', 'ADMIN',  'ACTIVE');

INSERT INTO `user_profile` (`user_id`, `level`, `is_verified`) VALUES
  (1, 'SILVER', 1),
  (2, 'GOLD',   1),
  (3, 'BRONZE', 0),
  (4, 'GOLD',   1),
  (5, 'GOLD',   1);


-- ── 핫딜 (hotdeal) 3개 ────────────────────────────────────────────────
INSERT INTO `posts`
  (`id`, `board_slug`, `user_id`, `title`, `content`, `thumbnail_url`, `extra_data`, `view_count`, `like_count`, `comment_count`, `created_at`) VALUES
  (1, 'hotdeal', 1,
   '[쿠팡] 삼성 정품 65W PD 충전기 19,900원 (역대가)',
   '와이파이 신청하다 발견했는데 65W 멀티 충전기가 역대 최저가로 떴어요.\n노트북·폰 같이 충전 가능하고 로켓배송이라 내일 도착합니다.\n품절 전에 쟁여두세요!',
   'https://picsum.photos/seed/hotdeal1/600/400',
   JSON_OBJECT('mall','쿠팡','price',19900,'original_price',39000,'discount_rate',49,'free_shipping',true,'deal_url','https://www.coupang.com/vp/products/123456','ends_at','2026-06-20','is_ended',false),
   1342, 87, 3, NOW() - INTERVAL 2 HOUR),

  (2, 'hotdeal', 3,
   '[11번가] 갤럭시 버즈3 프로 169,000원 카드할인 추가',
   '11번가 쇼킹딜로 버즈3 프로가 169,000원입니다.\nSK페이 + 제휴카드 5% 중복되면 16만원 초반까지 떨어져요.\n노이즈캔슬링 입문용으로 강추합니다.',
   'https://picsum.photos/seed/hotdeal2/600/400',
   JSON_OBJECT('mall','11번가','price',169000,'original_price',279000,'discount_rate',39,'free_shipping',true,'deal_url','https://www.11st.co.kr/products/987654','ends_at','2026-06-18','is_ended',false),
   980, 54, 2, NOW() - INTERVAL 8 HOUR),

  (3, 'hotdeal', 4,
   '[G마켓] 아이폰 정품 케이스 + 강화유리 세트 9,900원',
   '스마일클럽 회원 한정 9,900원 + 무료배송입니다.\n케이스랑 강화유리 2매 들어있어서 가성비 미쳤어요.\n기종 선택 잘 하시고 담으세요.',
   'https://picsum.photos/seed/hotdeal3/600/400',
   JSON_OBJECT('mall','G마켓','price',9900,'original_price',24000,'discount_rate',59,'free_shipping',true,'deal_url','https://www.gmarket.co.kr/item/555111','ends_at','2026-06-25','is_ended',false),
   430, 21, 1, NOW() - INTERVAL 1 DAY);


-- ── 휴대폰 성지 (offline) 3개 ─────────────────────────────────────────
INSERT INTO `posts`
  (`id`, `board_slug`, `user_id`, `title`, `content`, `thumbnail_url`, `extra_data`, `view_count`, `like_count`, `comment_count`, `created_at`) VALUES
  (4, 'offline', 2,
   '강남역 성지 갤럭시 S24 기변 39만원 후기 (SKT)',
   '강남역 11번 출구 성지 다녀왔습니다.\nS24 기본 256G 기준 SKT 기기변경 현금완납 39만원에 했어요.\n요금제 6개월 9만원대 유지 조건이고 부가서비스 1개만 깔았습니다.\n좌표 남겨요.',
   'https://picsum.photos/seed/offline1/600/400',
   JSON_OBJECT('region','서울','store_name','강남역성지','lat',37.498095,'lng',127.027610,'carrier','SKT','model','Galaxy S24','price',390000),
   2103, 132, 2, NOW() - INTERVAL 5 HOUR),

  (5, 'offline', 3,
   '부산 서면 아이폰15 번이 0원 가능한가요? (실후기)',
   '서면 지하상가 쪽 성지에서 아이폰15 128G 번호이동 상담받았습니다.\nKT로 옮기는 조건에 공시지원 + 추가지원 받아서 거의 0원에 가까웠어요.\n결합 있으면 더 빠진다고 하네요.',
   'https://picsum.photos/seed/offline2/600/400',
   JSON_OBJECT('region','부산','store_name','서면지하상가폰','lat',35.157655,'lng',129.059525,'carrier','KT','model','iPhone 15','price',0),
   1750, 96, 3, NOW() - INTERVAL 12 HOUR),

  (6, 'offline', 1,
   '대구 동성로 LG U+ 갤럭시 점프 차비폰 시세',
   '동성로 성지 시세 공유합니다.\nU+ 번이 기준 갤럭시 점프3 차비폰(마이너스폰)으로 풀려서 현금 5만원 받고 개통했어요.\n중고로 바로 넘기면 용돈벌이 됩니다.',
   'https://picsum.photos/seed/offline3/600/400',
   JSON_OBJECT('region','대구','store_name','동성로모바일','lat',35.869388,'lng',128.594950,'carrier','LGU+','model','Galaxy Jump3','price',-50000),
   620, 33, 1, NOW() - INTERVAL 2 DAY);


-- ── 이용후기 (reviews) 3개 ────────────────────────────────────────────
INSERT INTO `posts`
  (`id`, `board_slug`, `user_id`, `title`, `content`, `thumbnail_url`, `extra_data`, `view_count`, `like_count`, `comment_count`, `created_at`) VALUES
  (7, 'reviews', 2,
   '⭐⭐⭐⭐⭐ 찍고 보고 간 강남 성지 정직했어요',
   '여기 글 보고 강남 성지 갔는데 상담사분이 추가요금 없이 딱 안내한 그대로 진행해줬습니다.\n호갱당할까 걱정했는데 깔끔했어요. 평점 5점 드립니다.',
   'https://picsum.photos/seed/review1/600/400',
   JSON_OBJECT('rating',5,'store_name','강남역성지','model','Galaxy S24','carrier','SKT','purchase_price',390000),
   540, 41, 2, NOW() - INTERVAL 3 HOUR),

  (8, 'reviews', 3,
   '⭐⭐⭐ 온라인 성지 후기 - 개통은 됐는데 응대가 아쉬움',
   '비대면으로 진행했는데 가격은 저렴했습니다.\n다만 카톡 응답이 느려서 개통까지 이틀 걸렸어요.\n급한 분들은 참고하세요. 가격 3점, 친절도는 별로.',
   'https://picsum.photos/seed/review2/600/400',
   JSON_OBJECT('rating',3,'store_name','온라인비대면샵','model','iPhone 15','carrier','KT','purchase_price',150000),
   312, 18, 3, NOW() - INTERVAL 1 DAY),

  (9, 'reviews', 4,
   '⭐⭐⭐⭐⭐ 인터넷+TV 결합 사은품 30만원 실수령 후기',
   '인터넷 기가 + IPTV 결합 신청하고 현금 사은품 30만원 받았습니다.\n설치기사님도 친절하셨고 약속한 사은품 입금까지 깔끔했어요.\n결합 고민중이면 추천!',
   'https://picsum.photos/seed/review3/600/400',
   JSON_OBJECT('rating',5,'store_name','인터넷결합센터','model','기가인터넷+IPTV','carrier','LGU+','purchase_price',0),
   780, 63, 1, NOW() - INTERVAL 4 DAY);


-- ── 꿀팁게시판 (tips) 3개 ─────────────────────────────────────────────
INSERT INTO `posts`
  (`id`, `board_slug`, `user_id`, `title`, `content`, `thumbnail_url`, `extra_data`, `view_count`, `like_count`, `comment_count`, `is_notice`, `created_at`) VALUES
  (10, 'tips', 4,
   '[필독] 휴대폰 성지 갈 때 호갱 안 당하는 5가지 체크리스트',
   '1. 현금완납가 / 할부원금을 반드시 확인하세요.\n2. 요금제 유지기간과 부가서비스 의무 개수를 물어보세요.\n3. 신분증 사진을 함부로 넘기지 마세요.\n4. 개통 후 전산상 할부원금을 114로 확인하세요.\n5. "공짜"라는 말에 현혹되지 말고 표로 계산하세요.',
   'https://picsum.photos/seed/tips1/600/400',
   JSON_OBJECT('tags', JSON_ARRAY('호갱방지','체크리스트','입문')),
   3201, 248, 2, 1, NOW() - INTERVAL 6 HOUR),

  (11, 'tips', 1,
   '통신사 위약금 없이 갈아타는 타이밍 정리',
   '선택약정 24개월 기준으로 위약금이 어떻게 줄어드는지 정리했습니다.\n보통 18개월 지나면 위약금이 확 줄어들어서 그때가 갈아타기 좋아요.\n공시지원 받았으면 계산법이 다르니 주의!',
   'https://picsum.photos/seed/tips2/600/400',
   JSON_OBJECT('tags', JSON_ARRAY('위약금','선택약정','번호이동')),
   1456, 110, 3, 0, NOW() - INTERVAL 1 DAY),

  (12, 'tips', 3,
   '알뜰폰(MVNO) 요금제 고를 때 꿀팁 3가지',
   '1. 데이터 다 쓰면 속도제한 1Mbps인지 확인 (유튜브 480p 가능).\n2. 6개월 0원 프로모션 끝난 뒤 정상가를 꼭 보세요.\n3. 본인 명의 개통이면 미성년자도 가능합니다.\n망은 어차피 통신3사 빌려쓰는 거라 품질 차이 거의 없어요.',
   'https://picsum.photos/seed/tips3/600/400',
   JSON_OBJECT('tags', JSON_ARRAY('알뜰폰','MVNO','요금제')),
   890, 72, 1, 0, NOW() - INTERVAL 3 DAY);


-- ── 댓글 (각 게시판 대표 글에 몇 개씩 / 대댓글 포함) ──────────────────
INSERT INTO `comments` (`post_id`, `user_id`, `parent_id`, `content`, `like_count`, `created_at`) VALUES
  (1, 2, NULL, '오 방금 담았어요 정보 감사합니다!',        5, NOW() - INTERVAL 1 HOUR),
  (1, 3, NULL, '65W면 노트북도 되나요?',                   1, NOW() - INTERVAL 50 MINUTE),
  (1, 1, 2,    '네 65W라 웬만한 노트북 충전 됩니다 :)',      3, NOW() - INTERVAL 40 MINUTE),
  (4, 3, NULL, '좌표 감사합니다 주말에 가봐야겠네요',        8, NOW() - INTERVAL 3 HOUR),
  (4, 1, NULL, '요금제 9만원대면 좀 비싼편 아닌가요?',       2, NOW() - INTERVAL 2 HOUR),
  (10, 2, NULL, '이거 진짜 필독이네요 핀으로 박아주세요',    12, NOW() - INTERVAL 5 HOUR),
  (10, 3, NULL, '114로 할부원금 확인하는 거 처음 알았어요',   4, NOW() - INTERVAL 4 HOUR);


-- ── 게시글 좋아요 (UNIQUE(post_id,user_id) 준수) ──────────────────────
INSERT INTO `post_likes` (`post_id`, `user_id`) VALUES
  (1, 2), (1, 3), (1, 4),
  (4, 1), (4, 3), (4, 5),
  (10, 1), (10, 2), (10, 3);


-- ── (보너스) 휴대폰 정보 카탈로그 devices 샘플 ────────────────────────
INSERT INTO `devices`
  (`slug`, `brand`, `name`, `thumbnail_url`, `release_date`, `processor`, `ram_gb`, `storage_gb`,
   `display_inch`, `display_type`, `battery_mah`, `camera_main_mp`, `camera_summary`, `weight_g`, `os`,
   `antutu_score`, `official_price`, `extra_specs`) VALUES
  ('galaxy-s24-ultra', '삼성', 'Galaxy S24 Ultra', 'https://picsum.photos/seed/s24u/400/600', '2024-01-31',
   '스냅드래곤 8 Gen3', 12, 256, 6.8, 'Dynamic AMOLED 2X 120Hz', 5000, 200, '200MP+12MP+50MP+10MP', 232, 'Android 14',
   2050000, 1698400, JSON_OBJECT('water_resistance','IP68','port','USB-C','s_pen',true)),

  ('iphone-15-pro-max', '애플', 'iPhone 15 Pro Max', 'https://picsum.photos/seed/ip15pm/400/600', '2023-09-22',
   'A17 Pro', 8, 256, 6.7, 'Super Retina XDR 120Hz', 4422, 48, '48MP+12MP+12MP', 221, 'iOS 17',
   1560000, 1900000, JSON_OBJECT('water_resistance','IP68','port','USB-C','material','티타늄')),

  ('galaxy-z-flip6', '삼성', 'Galaxy Z Flip6', 'https://picsum.photos/seed/zflip6/400/600', '2024-07-24',
   '스냅드래곤 8 Gen3', 12, 256, 6.7, 'Dynamic AMOLED 2X 120Hz', 4000, 50, '50MP+12MP', 187, 'Android 14',
   1980000, 1487200, JSON_OBJECT('water_resistance','IP48','port','USB-C','foldable',true)),

  ('pixel-8-pro', '구글', 'Pixel 8 Pro', 'https://picsum.photos/seed/pixel8p/400/600', '2023-10-12',
   'Tensor G3', 12, 128, 6.7, 'LTPO OLED 120Hz', 5050, 50, '50MP+48MP+48MP', 213, 'Android 14',
   1180000, 1599000, JSON_OBJECT('water_resistance','IP68','port','USB-C','ai','Magic Editor'));


-- ── 확인용 요약 ───────────────────────────────────────────────────────
SELECT board_slug, COUNT(*) AS cnt FROM posts GROUP BY board_slug ORDER BY board_slug;
SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM posts) AS posts,
       (SELECT COUNT(*) FROM comments) AS comments, (SELECT COUNT(*) FROM post_likes) AS likes,
       (SELECT COUNT(*) FROM devices) AS devices;


-- & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p zzikko < zk-back\zzikko_seed.sql
-- SELECT board_slug, COUNT(*) FROM posts GROUP BY board_slug;
