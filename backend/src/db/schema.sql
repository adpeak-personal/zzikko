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
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL COMMENT 'scrypt: salt:hash (node:crypto)',
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
  UNIQUE KEY uq_users_nickname (nickname)
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
  type        ENUM('list','deal','gallery','news','spec') NOT NULL DEFAULT 'list',
  -- 글 작성 화면
  write_mode  ENUM('editor','photo') NOT NULL DEFAULT 'editor',
  -- 말머리 (JSON 문자열 배열)
  categories  JSON         NULL,
  seller_only TINYINT(1)   NOT NULL DEFAULT 0,
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
  thumb      VARCHAR(20)  NOT NULL DEFAULT 'violet' COMMENT '이미지 전까지 쓰는 그라디언트 키',
  thumb_url  VARCHAR(500) NULL,
  author     VARCHAR(30)  NOT NULL DEFAULT '찍고 편집팀',
  date       DATE         NOT NULL,
  featured   TINYINT(1)   NOT NULL DEFAULT 0,
  published  TINYINT(1)   NOT NULL DEFAULT 1,
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
  -- NULL 이면 아직 어느 글에도 안 쓰인 파일 — 유예 시간이 지나면 청소 대상이다
  post_id    INT UNSIGNED NULL,
  thumb_url  VARCHAR(500) NULL COMMENT '목록용 축소본. 글 등록 시 첫 이미지에만 만든다',
  width      SMALLINT UNSIGNED NULL,
  height     SMALLINT UNSIGNED NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_uploads_created (created_at DESC),
  KEY idx_uploads_orphan (post_id, created_at),
  CONSTRAINT fk_uploads_user FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT fk_uploads_post FOREIGN KEY (post_id)     REFERENCES posts (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ─────────────────────────────────────────────────────────────
-- 네이버 작업 계정 (nwork) — 블로그·밴드 등 외부 프로그램이 쓰는 계정
-- 옛 찍고 DB 에서 옮겨 온 실데이터가 들어 있다. 위쪽 DROP 목록에 넣지 말 것 —
-- 이 파일을 다시 돌려도 지워지지 않게 "없을 때만" 만든다.
-- 컬럼 이름은 외부 프로그램이 그대로 쓰므로 바꾸지 않는다.
-- ─────────────────────────────────────────────────────────────
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