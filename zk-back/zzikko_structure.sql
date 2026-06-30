CREATE DATABASE IF NOT EXISTS `zzikko` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE `zzikko`;


CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nickname` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `profile_image` varchar(511) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sns` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'local',
  `sns_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('BUYER','SELLER','ADMIN','SUB_ADMIN') COLLATE utf8mb4_unicode_ci DEFAULT 'BUYER',
  `status` enum('ACTIVE','INACTIVE','BANNED','DELETED') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uq_nickname` (`nickname`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 닉네임 alias 풀 (1 user : N aliases)
-- "찍고" 측에서 다양한 캐릭터로 글을 자동/수동 발행할 때 매번 다른 닉으로 보이게.
-- posts.display_nickname 에 INSERT 시점에 stamp 되어 그 글은 영구적으로 그 alias 로 표시.
-- =====================================================================
CREATE TABLE `user_aliases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `nickname` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `sort_order` int DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_alias_nickname` (`nickname`),
  KEY `idx_user_active` (`user_id`,`is_active`),
  CONSTRAINT `user_aliases_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `user_profile` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `level` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'BRONZE',
  `is_verified` tinyint(1) DEFAULT '0',
  `phone_number` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `user_profile_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE `user_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `refresh_token` varchar(511) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 통합 게시글 테이블
-- 게시판 정의는 프론트 navigation.ts(CATEGORIES)가 단일 소스.
-- posts 는 그 slug 문자열로 게시판을 구분한다. (예: 'hotdeal', 'offline')
-- 공통 필드는 컬럼으로, 게시판별 특수 필드는 extra_data(JSON)로 저장.
--   예) hotdeal: { "mall":"쿠팡", "price":29900, "original_price":59000,
--                  "discount_rate":49, "free_shipping":true,
--                  "deal_url":"https://...", "ends_at":"2026-06-20", "is_ended":false }
--   예) offline: { "region":"서울", "store_name":"강남성지", "lat":..., "lng":...,
--                  "carrier":"SKT", "model":"S24", "price":390000 }
-- =====================================================================
CREATE TABLE `posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `board_slug` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL, -- navigation.ts 의 카테고리 slug
  `sub_slug` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL, -- 1뎁스 더 (자유게시판 잡담/유머/질문 등). 다른 게시판은 NULL
  `user_id` int DEFAULT NULL,
  `display_nickname` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL, -- INSERT 시점에 user_aliases 풀에서 랜덤 stamp. NULL 이면 users.nickname 사용.
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL,
  `thumbnail_url` text COLLATE utf8mb4_unicode_ci,
  `extra_data` json DEFAULT NULL,                            -- 게시판별 확장 필드
  `view_count` int DEFAULT '0',
  `like_count` int DEFAULT '0',                             -- 비정규화 (목록 정렬/표시용)
  `comment_count` int DEFAULT '0',                          -- 비정규화 (목록 [n] 표시용)
  `is_notice` tinyint(1) DEFAULT '0',
  `status` enum('ACTIVE','HIDDEN','DELETED') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_board_created` (`board_slug`,`status`,`created_at`), -- 게시판별 목록 조회용
  KEY `idx_board_sub_created` (`board_slug`,`sub_slug`,`status`,`created_at`), -- 1뎁스 필터링용
  CONSTRAINT `posts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ──────────────────────────────────────────────────────────────────────
-- 운영 중인 DB 에 적용할 ALTER 문 (zzikko_structure.sql 통째 재실행 X)
-- ──────────────────────────────────────────────────────────────────────
-- ALTER TABLE `posts`
--   ADD COLUMN `sub_slug` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `board_slug`,
--   ADD KEY `idx_board_sub_created` (`board_slug`,`sub_slug`,`status`,`created_at`);
-- ──────────────────────────────────────────────────────────────────────


-- =====================================================================
-- 댓글 (모든 게시판 공용, 대댓글 지원: parent_id self-FK)
-- 질문·답변(qna) 게시판에서는 이 댓글이 곧 "답변" 역할을 한다.
--   - is_accepted = 1 인 댓글이 질문자가 채택한 "베스트 답변"
--   - 질문 해결 여부는 "채택 답변 존재 여부"로 판단 (WHERE post_id=? AND is_accepted=1)
-- =====================================================================
CREATE TABLE `comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `parent_id` int DEFAULT NULL,                             -- NULL이면 최상위 댓글, 값이 있으면 대댓글
  `content` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `like_count` int DEFAULT '0',
  `is_accepted` tinyint(1) DEFAULT '0',                     -- qna 채택 답변 여부 (1=베스트 답변)
  `status` enum('ACTIVE','DELETED') COLLATE utf8mb4_unicode_ci DEFAULT 'ACTIVE',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_post` (`post_id`,`status`),
  KEY `user_id` (`user_id`),
  KEY `parent_id` (`parent_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `comments_ibfk_3` FOREIGN KEY (`parent_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 게시글 좋아요/추천 (유저당 게시글 1회 — UNIQUE 로 중복 방지)
-- =====================================================================
CREATE TABLE `post_likes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_post_user` (`post_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `post_likes_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `post_likes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 휴대폰 정보 (devices) — 게시글이 아닌 "제품 카탈로그(정형 스펙)"
-- posts 와 분리하는 이유:
--   - 스펙 비교 기능: 컬럼이 정해져 있어야 기종끼리 나란히 비교 가능
--   - 순위/정렬:  ORDER BY antutu_score / battery_mah ...  (JSON 으론 비효율)
--   - 필터:       WHERE ram_gb >= 12  처럼 컬럼 인덱스로 빠르게
-- 표준화하기 애매한 부가 스펙은 extra_specs(JSON)로 흘려보낸다.
-- =====================================================================
CREATE TABLE `devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `slug` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,   -- URL 식별자 (예: galaxy-s24-ultra)
  `brand` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,  -- 삼성 / 애플 / 구글 ...
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,  -- Galaxy S24 Ultra
  `thumbnail_url` text COLLATE utf8mb4_unicode_ci,
  `release_date` date DEFAULT NULL,

  -- 핵심 스펙 (비교/정렬/필터 대상은 전부 컬럼으로)
  `processor` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,  -- 스냅드래곤 8 Gen3 등
  `ram_gb` tinyint DEFAULT NULL,                            -- 12
  `storage_gb` int DEFAULT NULL,                            -- 256 (기본/대표 용량)
  `display_inch` decimal(3,1) DEFAULT NULL,                 -- 6.8
  `display_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL, -- AMOLED 120Hz
  `battery_mah` int DEFAULT NULL,                           -- 5000
  `camera_main_mp` int DEFAULT NULL,                        -- 200 (메인 카메라 화소)
  `camera_summary` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL, -- "200MP+12MP+50MP+10MP"
  `weight_g` int DEFAULT NULL,
  `os` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,

  -- 순위용 지표
  `antutu_score` int DEFAULT NULL,                          -- 벤치마크 점수 (성능 순위 정렬용)
  `official_price` int DEFAULT NULL,                        -- 출고가

  `extra_specs` json DEFAULT NULL,                          -- 비표준 부가 스펙 (방수등급, 단자 등)
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_brand` (`brand`),                                -- 브랜드 필터
  KEY `idx_antutu` (`antutu_score`),                        -- 성능 순위 정렬
  KEY `idx_price` (`official_price`)                        -- 가격 정렬
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- 키워드 정리 (지역 / 기종 ++)
CREATE TABLE `keywords` (
  `id` int NOT NULL AUTO_INCREMENT,
  `category` enum('region','phone_model') NOT NULL,  -- 나중에 '통신사','사은품' 등 추가하기 쉬움
  `name` varchar(80) NOT NULL,                       -- "강남", "갤럭시 S26"
  `sort_order` int DEFAULT 0,                        -- 어드민에서 드래그 정렬
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_category_name` (`category`,`name`),
  KEY `idx_category_active` (`category`,`is_active`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 블로그 예약 발행 작업 (blog_jobs)
-- 어드민 BulkComposer 가 등록하는 "제목·키워드·예약시각" 1건 = 1행.
-- 지금은 zustand persist(localStorage) 에 보관 중이지만, 이 테이블로 옮기면:
--   1) 최근 N일 안에 같은 제목 재사용 차단 (앱 레이어 검사)
--   2) 최근 N일 안에 같은 키워드 재사용 차단 (앱 레이어 검사)
--   3) 여러 브라우저/디바이스에서 같은 큐를 본다
--
-- ⚠️ 중복 정책 메모:
--   - "영원히 UNIQUE" 로 막으면 글이 누적될수록 제목/키워드 고갈 문제가 생긴다.
--   - 그래서 DB 제약(UNIQUE) 대신, 등록 라우트에서 시간 윈도우(예: 20일) 검사로
--     "최근에 쓴 적 없으면 통과" 시킨다. 20일 지난 건 자연스럽게 재사용 가능.
--   - MySQL 은 partial index 가 없어서 이 정책을 컬럼 UNIQUE 로 표현 불가.
--     대신 (컬럼, created_at) 복합 인덱스로 윈도우 쿼리를 인덱스 스캔만으로 끝낸다.
--
-- 상태값은 프론트의 BlogJobStatus 와 1:1.
-- =====================================================================
CREATE TABLE `blog_jobs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,           -- 발행 제목
  `keywords` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,    -- 콤마구분 키워드 (디버깅·간편조회용 denormalized). 정규화 데이터는 blog_job_keywords 에도 동시 저장.
  `scheduled_at` datetime NOT NULL,                                   -- 예약 발행 시각
  `status` enum('PENDING','PROCESSING','DONE','FAILED') COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING',
  `result_url` varchar(511) COLLATE utf8mb4_unicode_ci DEFAULT NULL,  -- 발행 완료 후 결과 URL
  `error` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,               -- 실패 사유
  `published_at` timestamp NULL DEFAULT NULL,                         -- 실제로 발행된 시각 (워커가 채움)
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status_schedule` (`status`,`scheduled_at`),                -- 워커가 "PENDING 중 가장 이른 것" 픽업
  -- "최근 N일 안에 같은 제목 썼나?" 윈도우 쿼리용 복합 인덱스
  --   SELECT 1 FROM blog_jobs
  --    WHERE title = ? AND created_at >= NOW() - INTERVAL 20 DAY
  KEY `idx_title_recent` (`title`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- =====================================================================
-- 블로그 작업 키워드 (blog_job_keywords)
-- 한 블로그 작업당 키워드 N개 → 1:N 으로 분리 저장.
--
-- 중복 정책:
--   - 같은 글 안에서의 키워드 중복(예: ["강남","강남"]) 만 DB 가 차단
--     → UNIQUE(job_id, keyword)
--   - 다른 글 간 동일 키워드 재사용은 DB 가 막지 않고, 등록 라우트에서
--     "최근 N일 (예: 20일) 안에 같은 키워드를 쓴 글이 있는가?" 만 검사.
--     N일 지난 키워드는 자연히 재사용 가능.
--
-- 검사 쿼리(권장):
--   SELECT DISTINCT keyword
--     FROM blog_job_keywords
--    WHERE keyword IN (?)
--      AND created_at >= NOW() - INTERVAL 20 DAY;
-- =====================================================================
CREATE TABLE `blog_job_keywords` (
  `id` int NOT NULL AUTO_INCREMENT,
  `job_id` int NOT NULL,
  `keyword` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_job_keyword` (`job_id`,`keyword`),                   -- 같은 작업 안에서 키워드 중복 차단
  -- "최근 N일 안에 같은 키워드 썼나?" 윈도우 쿼리용 복합 인덱스
  KEY `idx_keyword_recent` (`keyword`,`created_at`),
  CONSTRAINT `blog_job_keywords_ibfk_1`
    FOREIGN KEY (`job_id`) REFERENCES `blog_jobs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;