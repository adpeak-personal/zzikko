-- =====================================================================
-- 찍고 (zzikko) MySQL 8 스키마
-- 적용: npm run db:init  (또는 mysql -u root -p -e "source src/db/schema.sql")
-- 도메인 타입: backend/src/types.ts (frontend/src/lib/types.ts 와 같은 형태)
--
-- ⚠️ 재실행하면 이 DB 의 테이블을 지우고 다시 만듭니다.
-- ⚠️ DB 이름을 바꾸지 말 것. 이 스크립트는 DROP TABLE 로 시작하므로, 다른 프로젝트가
--    쓰는 DB 를 가리키면 그쪽 테이블을 지웁니다. (`zzikko` 는 네이버 블로그 자동화
--    프로젝트가 쓰고 있어서 `zzikko_cafe` 로 따로 뒀습니다.)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS zzikko_cafe
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

-- 로컬 개발용 계정. 운영에서는 다른 비밀번호로 새로 만든다.
CREATE USER IF NOT EXISTS 'zzikko_cafe'@'localhost' IDENTIFIED BY 'zzikko_local_dev';
CREATE USER IF NOT EXISTS 'zzikko_cafe'@'127.0.0.1' IDENTIFIED BY 'zzikko_local_dev';
GRANT ALL PRIVILEGES ON zzikko_cafe.* TO 'zzikko_cafe'@'localhost';
GRANT ALL PRIVILEGES ON zzikko_cafe.* TO 'zzikko_cafe'@'127.0.0.1';
FLUSH PRIVILEGES;

USE zzikko_cafe;
SET NAMES utf8mb4;

-- 의존성 역순으로 삭제
DROP TABLE IF EXISTS
  mvno_plans,
  news_feed,
  sise_reports,
  sise_sheets, seller_applications;
DROP TABLE IF EXISTS phone_verifications;
DROP TABLE IF EXISTS blog_profiles;
DROP TABLE IF EXISTS uploads;
DROP TABLE IF EXISTS post_scraps;
DROP TABLE IF EXISTS comment_likes;
DROP TABLE IF EXISTS phone_specs;
DROP TABLE IF EXISTS chipsets;
DROP TABLE IF EXISTS news_articles;
DROP TABLE IF EXISTS post_likes;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS post_deals;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS boards;
DROP TABLE IF EXISTS board_groups;
DROP TABLE IF EXISTS shops;
DROP TABLE IF EXISTS users;

-- ---------------------------------------------------------------------
-- 회원
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- 카카오로 가입한 회원은 이메일·비밀번호가 없다
  email         VARCHAR(255) NULL,
  password_hash VARCHAR(255) NULL COMMENT 'scrypt: salt:hash (node:crypto)',
  kakao_id      VARCHAR(32)  NULL COMMENT '카카오 회원번호',
  -- 이메일 가입 때 인증한 휴대폰. 번호 원본은 두지 않는다 (HMAC — 한 번호 한 계정 확인용)
  phone_hash    CHAR(64)     NULL,
  nickname      VARCHAR(30)  NOT NULL,
  avatar_color  CHAR(7)      NOT NULL DEFAULT '#fa6038',
  level         ENUM('새싹','눈팅러','단골','고수','성지지기','운영진') NOT NULL DEFAULT '새싹',
  role          ENUM('회원','판매자','운영진') NOT NULL DEFAULT '회원',
  region        VARCHAR(20)  NOT NULL DEFAULT '서울',
  bio           VARCHAR(200) NULL,
  -- 판매자면 소속 매장 (매장 생성 후 UPDATE 로 연결)
  shop_id       INT UNSIGNED NULL,
  joined_at     DATE         NOT NULL DEFAULT (CURRENT_DATE),
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_nickname (nickname),
  UNIQUE KEY uq_users_kakao (kakao_id),
  UNIQUE KEY uq_users_phone (phone_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 휴대폰 인증번호. 번호도 코드도 해시로만 둔다
CREATE TABLE phone_verifications (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone_hash  CHAR(64)     NOT NULL,
  code_hash   CHAR(64)     NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at  DATETIME     NOT NULL,
  verified_at DATETIME     NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_phone_verifications_phone (phone_hash, created_at),
  KEY idx_phone_verifications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 판매자 매장 (성지)
-- ---------------------------------------------------------------------
CREATE TABLE shops (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug         VARCHAR(60)  NOT NULL,
  name         VARCHAR(60)  NOT NULL,
  region       VARCHAR(20)  NOT NULL,
  area         VARCHAR(60)  NOT NULL,
  owner_id     INT UNSIGNED NULL,
  intro        VARCHAR(200) NOT NULL DEFAULT '',
  rating       DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  review_count INT UNSIGNED NOT NULL DEFAULT 0,
  verified     TINYINT(1)   NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_shops_slug (slug),
  KEY idx_shops_owner (owner_id),
  CONSTRAINT fk_shops_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE users
  ADD CONSTRAINT fk_users_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- 게시판 (대분류 → 소분류)
-- ---------------------------------------------------------------------
CREATE TABLE board_groups (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(60) NOT NULL,
  sort_order INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_board_groups_sort (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE boards (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id    INT UNSIGNED NOT NULL,
  slug        VARCHAR(40)  NOT NULL,
  name        VARCHAR(40)  NOT NULL,
  description VARCHAR(200) NOT NULL DEFAULT '',
  -- 목록을 그리는 방식
  type        ENUM('list','deal','gallery','news','spec','plan') NOT NULL DEFAULT 'list',
  -- 글 작성 화면
  write_mode  ENUM('editor','photo') NOT NULL DEFAULT 'editor',
  -- 말머리 (JSON 문자열 배열)
  categories  JSON         NULL,
  seller_only TINYINT(1)   NOT NULL DEFAULT 0,
  -- 운영진만 글을 쓸 수 있는 게시판 (공지사항 등)
  admin_only  TINYINT(1)   NOT NULL DEFAULT 0,
  sort_order  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_boards_slug (slug),
  KEY idx_boards_group (group_id, sort_order),
  CONSTRAINT fk_boards_group FOREIGN KEY (group_id) REFERENCES board_groups (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 게시글 / 댓글
-- ---------------------------------------------------------------------
CREATE TABLE posts (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  board_id      INT UNSIGNED NOT NULL,
  author_id     INT UNSIGNED NOT NULL,
  category      VARCHAR(40)  NULL COMMENT '말머리',
  region        VARCHAR(20)  NULL,
  title         VARCHAR(200) NOT NULL,
  -- 저장 정본은 ProseMirror JSON, HTML 은 서버가 파생시킨 값
  content_json  JSON         NULL,
  content_html  MEDIUMTEXT   NULL,
  -- 목록 미리보기·검색용 평문
  content_text  MEDIUMTEXT   NOT NULL DEFAULT (''),
  thumb_url     VARCHAR(500) NULL,
  is_notice     TINYINT(1)   NOT NULL DEFAULT 0,
  views         INT UNSIGNED NOT NULL DEFAULT 0,
  likes         INT UNSIGNED NOT NULL DEFAULT 0,
  comment_count INT UNSIGNED NOT NULL DEFAULT 0,
  -- 실제로 지우지 않는다. 지우면 댓글·좋아요가 CASCADE 로 함께 날아가 복구할 수 없다
  deleted_at    DATETIME     NULL COMMENT '지운 시각. NULL 이면 살아 있는 글',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_posts_alive (deleted_at, created_at),
  KEY idx_posts_board_created (board_id, created_at DESC),
  KEY idx_posts_author (author_id),
  KEY idx_posts_notice (is_notice, created_at DESC),
  FULLTEXT KEY ft_posts_search (title, content_text) WITH PARSER ngram,
  CONSTRAINT fk_posts_board FOREIGN KEY (board_id) REFERENCES boards (id) ON DELETE CASCADE,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 시세 글에만 붙는 가입 조건 (1:1)
CREATE TABLE post_deals (
  post_id      INT UNSIGNED NOT NULL,
  shop_id      INT UNSIGNED NOT NULL,
  model        VARCHAR(60)  NOT NULL,
  storage      VARCHAR(30)  NOT NULL DEFAULT '',
  carrier      ENUM('SKT','KT','LG U+','알뜰폰') NOT NULL,
  join_type    ENUM('번호이동','기기변경','신규가입') NOT NULL,
  principal    INT UNSIGNED NOT NULL COMMENT '할부원금(원)',
  plan         VARCHAR(100) NOT NULL DEFAULT '',
  plan_months  TINYINT UNSIGNED NOT NULL DEFAULT 6,
  addons       JSON         NULL,
  PRIMARY KEY (post_id),
  KEY idx_post_deals_shop (shop_id),
  KEY idx_post_deals_model (model),
  CONSTRAINT fk_post_deals_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_deals_shop FOREIGN KEY (shop_id) REFERENCES shops (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE comments (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id    INT UNSIGNED NOT NULL,
  author_id  INT UNSIGNED NOT NULL,
  parent_id  INT UNSIGNED NULL COMMENT '대댓글',
  content    TEXT         NOT NULL,
  likes      INT UNSIGNED NOT NULL DEFAULT 0,
  deleted_at DATETIME     NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_comments_post (post_id, created_at),
  KEY idx_comments_alive (post_id, deleted_at),
  CONSTRAINT fk_comments_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_author FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 같은 사람이 같은 글에 두 번 좋아요를 못 누르게 한다
CREATE TABLE post_likes (
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  CONSTRAINT fk_post_likes_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- IT 소식 (어드민이 관리하는 기사)
-- ---------------------------------------------------------------------
-- 스크랩(북마크) — 본인만 보는 값이라 공개 집계를 두지 않는다
CREATE TABLE post_scraps (
  post_id    INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  KEY idx_post_scraps_user (user_id, created_at),
  CONSTRAINT fk_post_scraps_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_post_scraps_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- comments.likes 는 이 표의 개수를 캐시한 값이다
CREATE TABLE comment_likes (
  comment_id INT UNSIGNED NOT NULL,
  user_id    INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (comment_id, user_id),
  KEY idx_comment_likes_user (user_id),
  CONSTRAINT fk_comment_likes_comment FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
  CONSTRAINT fk_comment_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE news_articles (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title      VARCHAR(120) NOT NULL,
  category   VARCHAR(30)  NOT NULL,
  summary    VARCHAR(200) NOT NULL DEFAULT '',
  body       MEDIUMTEXT   NOT NULL,
  thumb      VARCHAR(20)  NOT NULL DEFAULT 'violet' COMMENT '사진이 없을 때 쓰는 그라디언트 키',
  -- 사진은 여기가 정본이다. thumb_url 은 images[0] 에서 따 둔 값(목록 조회용)
  images     JSON         NULL COMMENT '[{url, caption}] — 순서가 곧 노출 순서',
  thumb_url  VARCHAR(500) NULL,
  author     VARCHAR(30)  NOT NULL DEFAULT '찍고 편집팀',
  date       DATE         NOT NULL,
  featured   TINYINT(1)   NOT NULL DEFAULT 0,
  published  TINYINT(1)   NOT NULL DEFAULT 1,
  -- 출처 표기가 이용 조건이라 비워두면 안 된다 (직접 쓴 글이면 NULL)
  source_name VARCHAR(60)  NULL,
  source_url  VARCHAR(500) NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_news_published (published, date DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 칩셋 / 기종 사양
-- ---------------------------------------------------------------------
CREATE TABLE chipsets (
  id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name  VARCHAR(40) NOT NULL,
  maker VARCHAR(20) NOT NULL,
  -- 벤치 점수 대신 등급으로만 비교한다 (같은 등급은 서열 없음)
  tier  ENUM('플래그십','준플래그십','중급','보급형') NOT NULL,
  year  SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_chipsets_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE phone_specs (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name           VARCHAR(40)  NOT NULL,
  brand          ENUM('Samsung','Apple','기타') NOT NULL,
  release_date   CHAR(7)      NOT NULL COMMENT 'YYYY-MM',
  retail_price   INT UNSIGNED NOT NULL DEFAULT 0,
  chipset_id     INT UNSIGNED NULL,

  -- 표시용 문자열
  display        VARCHAR(80)  NOT NULL DEFAULT '',
  storage        VARCHAR(60)  NOT NULL DEFAULT '',
  battery        VARCHAR(40)  NOT NULL DEFAULT '',
  charging       VARCHAR(60)  NOT NULL DEFAULT '',
  camera_main    VARCHAR(80)  NOT NULL DEFAULT '',
  camera_front   VARCHAR(60)  NOT NULL DEFAULT '',
  weight         VARCHAR(20)  NOT NULL DEFAULT '',

  -- 비교용 숫자 (0 이면 그 항목은 비교에서 제외)
  display_inch   DECIMAL(3,1) NOT NULL DEFAULT 0,
  refresh_hz     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  memory_gb      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  battery_mah    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  charging_watt  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  camera_main_mp SMALLINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '만 화소',
  weight_g       SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  thumb          VARCHAR(20)  NOT NULL DEFAULT 'violet',
  -- 사진은 여기가 정본이다. thumb_url 은 images[0] 에서 따 둔 값(목록 조회용)
  images         JSON         NULL COMMENT '[{url, caption}] — 순서가 곧 노출 순서',
  thumb_url      VARCHAR(500) NULL,
  published      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_specs_published (published),
  KEY idx_specs_chipset (chipset_id),
  -- 쓰고 있는 칩셋은 지우지 못하게 한다
  CONSTRAINT fk_specs_chipset FOREIGN KEY (chipset_id) REFERENCES chipsets (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 업로드 파일
-- ---------------------------------------------------------------------
CREATE TABLE uploads (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  url        VARCHAR(500) NOT NULL COMMENT '/uploads/... 상대경로',
  filename   VARCHAR(255) NOT NULL,
  mimetype   VARCHAR(100) NOT NULL,
  size       INT UNSIGNED NOT NULL,
  uploader_id INT UNSIGNED NULL,
  -- post_id 와 owner 가 **둘 다** NULL 이면 아직 아무 데도 안 쓰인 파일 —
  -- 유예 시간이 지나면 청소 대상이다 (lib/maintenance.ts)
  post_id    INT UNSIGNED NULL,
  -- 글이 아닌 콘텐츠(기사·기종)가 쓰는 중이면 'news:9' / 'spec:3'.
  -- posts 는 FK 가 걸린 post_id 를 쓰므로 여기엔 안 들어온다.
  owner      VARCHAR(40)  NULL,
  thumb_url  VARCHAR(500) NULL COMMENT '목록용 축소본. 글 등록 시 첫 이미지에만 만든다',
  width      SMALLINT UNSIGNED NULL,
  height     SMALLINT UNSIGNED NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_uploads_created (created_at DESC),
  KEY idx_uploads_orphan (post_id, created_at),
  KEY idx_uploads_owner (owner),
  CONSTRAINT fk_uploads_user FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_uploads_post FOREIGN KEY (post_id)     REFERENCES posts (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ─────────────────────────────────────────────────────────────
-- 판매자 입점 신청 (/seller 페이지에서 들어온다)
-- 회원가입과 별개다 — 아직 회원이 아닌 사람이 연락처만 남기는 창구다.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE seller_applications (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  shop_name  VARCHAR(60)  NOT NULL COMMENT '매장 이름',
  manager    VARCHAR(30)  NOT NULL COMMENT '담당자',
  phone      VARCHAR(20)  NOT NULL COMMENT '숫자만 저장한다',
  region     VARCHAR(20)  NOT NULL,
  area       VARCHAR(60)  NULL COMMENT '시·군·구 (예: 강남구)',
  carriers   JSON         NULL COMMENT '취급 통신사 ["SKT","KT"]',
  channel    VARCHAR(30)  NULL COMMENT '지금 조건을 올리는 곳 — 카톡 · 밴드 · 뽐뿌 …',
  message    TEXT         NULL COMMENT '하고 싶은 말',
  status     ENUM('신청','연락중','승인','보류') NOT NULL DEFAULT '신청',
  memo       TEXT         NULL COMMENT '운영진 메모 — 신청자에게 보이지 않는다',
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_seller_apps (status, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ─────────────────────────────────────────────────────────────
-- 네이버 작업 계정 (nwork) — 블로그·밴드 등 외부 프로그램이 쓰는 계정
-- 옛 찍고 DB 에서 옮겨 온 실데이터가 들어 있다. 위쪽 DROP 목록에 넣지 말 것 —
-- 이 파일을 다시 돌려도 지워지지 않게 "없을 때만" 만든다.
-- 컬럼 이름은 외부 프로그램이 그대로 쓰므로 바꾸지 않는다.
-- ─────────────────────────────────────────────────────────────
-- ---------------------------------------------------------------------
-- 시세 리포트 (SEO·GEO 용)
--
-- 사이트 게시판(posts)과 **일부러 분리했다.** posts 에 "숨김" 칼럼을 더하면
-- 목록·검색·공지·스크랩·작성자글·어드민통계 모든 조회에 필터를 걸어야 하고,
-- 하나만 빠뜨려도 사이트에 노출된다. 따로 두면 그 위험이 없다.
--
-- 노출: /sise 목록과 상세만. 사이드바·헤더 메뉴에는 걸지 않는다.
-- ---------------------------------------------------------------------
CREATE TABLE sise_sheets (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  region     VARCHAR(20)  NOT NULL,
  dated_on   DATE         NOT NULL COMMENT '시세 기준일. 올린 날이 아니라 표에 적힌 날',
  image_url  VARCHAR(500) NOT NULL COMMENT '원본 시세표 이미지 (도메인 없는 경로)',
  -- 추출된 행: [{series, model, storage, carrier, plan, joinType, price}]
  -- price 단위는 만원, 음수는 페이백 (-23 = 23만원 페이백)
  rows_json  JSON         NOT NULL,
  note       VARCHAR(300) NOT NULL DEFAULT '' COMMENT '표 상단 조건문 (유심 이동 할인 등)',
  created_by INT UNSIGNED NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sise_sheets_region (region, dated_on DESC),
  CONSTRAINT fk_sise_sheets_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE sise_reports (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  sheet_id     INT UNSIGNED NOT NULL,
  slug         VARCHAR(120) NOT NULL,
  title        VARCHAR(200) NOT NULL,
  summary      VARCHAR(300) NOT NULL DEFAULT '',
  -- AI 가 쓴 해설만 담는다. 표는 sise_sheets.rows_json 으로 화면에서 그린다 —
  -- 숫자를 AI 에게 맡기면 환각으로 가격이 틀어진다.
  sections     JSON         NOT NULL COMMENT '{lead, highlights[], closing}',
  -- 직전 시트와의 비교 결과 [{model, storage, carrier, joinType, before, after, delta}]
  changes      JSON         NULL,
  compared_to  INT UNSIGNED NULL COMMENT '비교한 직전 시트. 없으면 첫 글',
  published    TINYINT(1)   NOT NULL DEFAULT 0,
  published_at DATETIME     NULL,
  views        INT UNSIGNED NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sise_reports_slug (slug),
  KEY idx_sise_reports_live (published, published_at DESC),
  CONSTRAINT fk_sise_reports_sheet FOREIGN KEY (sheet_id) REFERENCES sise_sheets (id) ON DELETE CASCADE,
  CONSTRAINT fk_sise_reports_prev FOREIGN KEY (compared_to) REFERENCES sise_sheets (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 어느 지역 시세 글을 쓸지 고르는 목록. 네이버 검색광고 API 에서 받아 쌓는다.
-- 검색량이 받쳐주는 지역만 쓰기 위한 것 — "경기"는 거의 안 찾고 "부천"은 많이 찾는다.
CREATE TABLE sise_keywords (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  keyword     VARCHAR(60)  NOT NULL COMMENT '예: 수원휴대폰성지',
  place       VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '묶음 지역명. 시세표의 region 으로 쓴다',
  monthly     INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '월간검색수 (PC+모바일)',
  competition VARCHAR(10)  NOT NULL DEFAULT '' COMMENT '네이버 경쟁정도',
  done        TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '이 지역 글을 썼는지',
  done_at     DATETIME     NULL,
  hidden      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '안 쓸 키워드. 목록에서 빼지만 행은 남긴다',
  fetched_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sise_keywords_keyword (keyword),
  KEY idx_sise_keywords_rank (done, monthly DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- 뉴스 수집함 (GSMArena RSS)
--
-- 출처(GSMArena)가 license.xml 로 "ai-summarize 허용 / 출처 표기(CC BY 4.0) 조건"
-- 을 밝혀 두었다. 그래서 원문을 그대로 옮기지 않고 요약·재작성하며,
-- 기사에는 반드시 출처 이름과 링크를 남긴다.
-- ---------------------------------------------------------------------
-- 유심 요금제 — 바깥 목록에서 받아 온다(lib/plans). 회원 글이 아니다.
-- 목록에서 빠진 요금제는 지우지 않고 active = 0 (다시 나오면 같은 행으로 돌아온다)
CREATE TABLE mvno_plans (
  id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  source          VARCHAR(20)   NOT NULL COMMENT '받아 온 곳 (dnbn)',
  source_id       VARCHAR(80)   NOT NULL COMMENT '그쪽 요금제 id',
  carrier         VARCHAR(40)   NOT NULL COMMENT '파는 곳',
  network         VARCHAR(10)   NOT NULL DEFAULT '' COMMENT '망 (SKT/KT/LG U+)',
  tech            VARCHAR(10)   NOT NULL DEFAULT '' COMMENT 'LTE/5G',
  name            VARCHAR(120)  NOT NULL,
  tags            JSON          NULL,
  data_text       VARCHAR(40)   NOT NULL DEFAULT '' COMMENT '화면용 문장',
  data_gb         DECIMAL(7,1)  NULL COMMENT '비교용 월 데이터',
  daily_gb        DECIMAL(5,1)  NULL COMMENT '하루 추가 데이터',
  unlimited       TINYINT(1)    NOT NULL DEFAULT 0,
  after_speed     VARCHAR(60)   NOT NULL DEFAULT '',
  voice           VARCHAR(20)   NOT NULL DEFAULT '',
  sms             VARCHAR(20)   NOT NULL DEFAULT '',
  monthly_fee     INT           NOT NULL COMMENT '지금 내는 월 요금(원)',
  promo_months    INT           NULL COMMENT '할인 기간(개월)',
  fee_after_promo INT           NULL COMMENT '할인 끝난 뒤 요금(원)',
  regular_fee     INT           NULL COMMENT '정가(원)',
  benefit         VARCHAR(300)  NOT NULL DEFAULT '',
  perks           JSON          NULL,
  conditions      JSON          NULL,
  source_url      VARCHAR(300)  NOT NULL,
  active          TINYINT(1)    NOT NULL DEFAULT 1,
  first_seen_at   DATETIME      NOT NULL,
  last_seen_at    DATETIME      NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_mvno_plans_source (source, source_id),
  KEY idx_mvno_plans_active (active, monthly_fee)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
CREATE TABLE news_feed (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  guid         VARCHAR(500) NOT NULL COMMENT 'RSS guid. 같은 글을 두 번 담지 않으려는 열쇠',
  title        VARCHAR(300) NOT NULL COMMENT '원문 제목 — 손대지 않는다',
  title_ko     VARCHAR(300) NULL     COMMENT '한국어로 옮긴 제목. 목록에 이걸 띄운다',
  link         VARCHAR(500) NOT NULL,
  published_at DATETIME     NOT NULL,
  source_text  MEDIUMTEXT   NOT NULL COMMENT 'RSS 가 준 원문. 기사를 쓰고 나면 지워도 된다',
  source_name  VARCHAR(60)  NOT NULL DEFAULT 'GSMArena',
  -- '삭제'는 행을 지우지 않는다. guid 가 UNIQUE 라 지우면 다음 수집 때 다시 들어온다.
  status       ENUM('수집','작성됨','숨김','삭제') NOT NULL DEFAULT '수집',
  article_id   INT UNSIGNED NULL COMMENT '이 항목으로 쓴 기사',
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_news_feed_guid (guid),
  KEY idx_news_feed_list (status, published_at DESC),
  CONSTRAINT fk_news_feed_article FOREIGN KEY (article_id) REFERENCES news_articles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS nwork (
  n_idx           INT          NOT NULL AUTO_INCREMENT,
  n_id            VARCHAR(100) NOT NULL,
  n_pwd           VARCHAR(100) NOT NULL,
  n_memo1         VARCHAR(255) DEFAULT NULL,
  n_memo2         VARCHAR(255) DEFAULT NULL,
  n_memo3         VARCHAR(255) DEFAULT NULL,
  last_login_chk  DATETIME     DEFAULT NULL,
  n_lastwork_at   DATETIME     DEFAULT NULL,
  use_status      TINYINT(1)   NOT NULL DEFAULT 0,
  task_role       VARCHAR(20)  NOT NULL DEFAULT '미사용',
  work_used       TINYINT(1)   NOT NULL DEFAULT 0,
  work_user_agent INT          DEFAULT NULL,
  work_profile    VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (n_idx),
  UNIQUE KEY n_id (n_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 블로그 작업 프로필 — IP(프록시) 하나와 크롬 프로필 하나가 한 쌍.
-- 계정(nwork)이 work_profile 이름으로 여기에 붙는다 (보통 셋).
CREATE TABLE blog_profiles (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  -- 크롬 프로필 폴더 이름이자 nwork.work_profile 과 묶는 키
  name        VARCHAR(100) NOT NULL,
  -- 산 IP 하나. 프로필 하나에 IP 하나다
  proxy_host  VARCHAR(120) NOT NULL DEFAULT '',
  proxy_port  INT UNSIGNED NULL,
  proxy_user  VARCHAR(100) NOT NULL DEFAULT '',
  proxy_pass  VARCHAR(100) NOT NULL DEFAULT '',
  user_agent  VARCHAR(255) NOT NULL DEFAULT '',
  note        VARCHAR(255) NOT NULL DEFAULT '',
  -- 이 프로필일 때 밖에서 보여야 할 IP. 다르면 작업기가 로그인하지 않고 멈춘다
  expected_ip  VARCHAR(45)  NOT NULL DEFAULT '',
  -- VPN 에서 고를 위치 이름 (자동 전환에 쓴다)
  vpn_location VARCHAR(100) NOT NULL DEFAULT '',
  active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_ok_at  DATETIME     NULL COMMENT '이 프로필로 마지막에 로그인이 통한 시각',
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_blog_profiles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;