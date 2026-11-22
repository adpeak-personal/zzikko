/**
 * 이미 쓰고 있는 DB 에 스키마 변경분을 적용한다.
 *
 *   npm run db:migrate          무엇이 빠졌는지 보여주기만
 *   npm run db:migrate -- --yes 실제 적용
 *
 * schema.sql 은 `DROP TABLE` 로 시작하는 "처음부터 만들기" 용이라 데이터가 든 DB 에 쓸 수 없다.
 * 여기 적힌 단계는 전부 "없을 때만" 적용되므로 여러 번 돌려도 안전하다.
 *
 * 새 변경이 생기면 steps 에 한 칸을 더한다. schema.sql 도 같이 고칠 것 —
 * 처음 설치하는 사람은 schema.sql 만 보기 때문이다.
 */
import mysql from 'mysql2/promise';
import { loadEnv } from './env.mjs';

loadEnv();

const confirmed = process.argv.includes('--yes');

const steps = [
  {
    name: 'posts.deleted_at / comments.deleted_at — 소프트 삭제',
    // 글을 실제로 지우면 댓글·좋아요가 CASCADE 로 함께 날아가 복구할 수 없다
    check: (c) => hasColumn(c, 'posts', 'deleted_at'),
    sql: [
      `ALTER TABLE posts
         ADD COLUMN deleted_at DATETIME NULL COMMENT '지운 시각. NULL 이면 살아 있는 글',
         ADD KEY idx_posts_alive (deleted_at, created_at)`,
      `ALTER TABLE comments
         ADD COLUMN deleted_at DATETIME NULL,
         ADD KEY idx_comments_alive (post_id, deleted_at)`,
    ],
  },
  {
    name: 'uploads 확장 — 글 연결 · 파생본 · 크기',
    // post_id 가 없으면 "어느 글에 쓰였는지" 를 몰라 안 쓰인 이미지를 영영 못 지운다
    check: (c) => hasColumn(c, 'uploads', 'post_id'),
    sql: [
      `ALTER TABLE uploads
         ADD COLUMN post_id    INT UNSIGNED NULL COMMENT 'NULL 이면 아직 어느 글에도 안 쓰인 파일' AFTER uploader_id,
         ADD COLUMN thumb_url  VARCHAR(500) NULL COMMENT '목록용 축소본. 글 등록 시 첫 이미지에만 만든다',
         ADD COLUMN width      SMALLINT UNSIGNED NULL,
         ADD COLUMN height     SMALLINT UNSIGNED NULL,
         ADD KEY idx_uploads_orphan (post_id, created_at),
         ADD CONSTRAINT fk_uploads_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE SET NULL`,
    ],
  },
  {
    name: 'post_scraps — 스크랩',
    check: (c) => hasTable(c, 'post_scraps'),
    sql: [
      `CREATE TABLE post_scraps (
         post_id    INT UNSIGNED NOT NULL,
         user_id    INT UNSIGNED NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (post_id, user_id),
         KEY idx_post_scraps_user (user_id, created_at),
         CONSTRAINT fk_post_scraps_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
         CONSTRAINT fk_post_scraps_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    ],
  },
  {
    name: 'comment_likes — 댓글 좋아요',
    check: (c) => hasTable(c, 'comment_likes'),
    sql: [
      `CREATE TABLE comment_likes (
         comment_id INT UNSIGNED NOT NULL,
         user_id    INT UNSIGNED NOT NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (comment_id, user_id),
         KEY idx_comment_likes_user (user_id),
         CONSTRAINT fk_comment_likes_comment FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE,
         CONSTRAINT fk_comment_likes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    ],
  },
  {
    // 운영 DB 에는 옛 찍고에서 옮긴 실데이터로 이미 있다 — 새로 까는 DB 에만 만들어진다
    name: 'nwork — 네이버 작업 계정',
    check: (c) => hasTable(c, 'nwork'),
    sql: [
      `CREATE TABLE IF NOT EXISTS nwork (
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
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    ],
  },
  {
    name: 'seller_applications — 판매자 입점 신청',
    check: (c) => hasTable(c, 'seller_applications'),
    sql: [
      `CREATE TABLE IF NOT EXISTS seller_applications (
         id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
         shop_name  VARCHAR(60)  NOT NULL,
         manager    VARCHAR(30)  NOT NULL,
         phone      VARCHAR(20)  NOT NULL,
         region     VARCHAR(20)  NOT NULL,
         area       VARCHAR(60)  NULL,
         carriers   JSON         NULL,
         channel    VARCHAR(30)  NULL,
         message    TEXT         NULL,
         status     ENUM('신청','연락중','승인','보류') NOT NULL DEFAULT '신청',
         memo       TEXT         NULL,
         created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_seller_apps (status, created_at DESC)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    ],
  },
  {
    // 출처(GSMArena)가 license.xml 로 "ai-summarize 허용 / 출처 표기 조건" 을 밝혀 두었다.
    // 그래서 원문을 그대로 옮기지 않고 요약·재작성하며, 기사에 출처와 링크를 남긴다.
    name: 'news_feed + news_articles.source_* — 뉴스 수집함',
    check: (c) => hasTable(c, 'news_feed'),
    sql: [
      `ALTER TABLE news_articles
         ADD COLUMN source_name VARCHAR(60)  NULL,
         ADD COLUMN source_url  VARCHAR(500) NULL`,
      `CREATE TABLE IF NOT EXISTS news_feed (
         id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
         guid         VARCHAR(500) NOT NULL,
         title        VARCHAR(300) NOT NULL,
         link         VARCHAR(500) NOT NULL,
         published_at DATETIME     NOT NULL,
         source_text  MEDIUMTEXT   NOT NULL,
         source_name  VARCHAR(60)  NOT NULL DEFAULT 'GSMArena',
         status       ENUM('수집','작성됨','숨김') NOT NULL DEFAULT '수집',
         article_id   INT UNSIGNED NULL,
         created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_news_feed_guid (guid),
         KEY idx_news_feed_list (status, published_at DESC),
         CONSTRAINT fk_news_feed_article FOREIGN KEY (article_id) REFERENCES news_articles (id) ON DELETE SET NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    ],
  },
  {
    // 시세 리포트는 posts 와 분리해 둔다 — 사이트에 노출되지 않아야 해서,
    // posts 에 섞으면 모든 목록 조회에 필터를 걸어야 하고 하나만 빠뜨려도 새어 나간다.
    name: 'sise_sheets / sise_reports — 시세 리포트 (SEO)',
    check: (c) => hasTable(c, 'sise_reports'),
    sql: [
      `CREATE TABLE IF NOT EXISTS sise_sheets (
         id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
         region     VARCHAR(20)  NOT NULL,
         dated_on   DATE         NOT NULL COMMENT '시세 기준일. 올린 날이 아니라 표에 적힌 날',
         image_url  VARCHAR(500) NOT NULL COMMENT '원본 시세표 이미지 (도메인 없는 경로)',
         rows_json  JSON         NOT NULL,
         note       VARCHAR(300) NOT NULL DEFAULT '',
         created_by INT UNSIGNED NULL,
         created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_sise_sheets_region (region, dated_on DESC),
         CONSTRAINT fk_sise_sheets_user FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
      `CREATE TABLE IF NOT EXISTS sise_reports (
         id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
         sheet_id     INT UNSIGNED NOT NULL,
         slug         VARCHAR(120) NOT NULL,
         title        VARCHAR(200) NOT NULL,
         summary      VARCHAR(300) NOT NULL DEFAULT '',
         sections     JSON         NOT NULL COMMENT '{lead, highlights[], closing}',
         changes      JSON         NULL,
         compared_to  INT UNSIGNED NULL,
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
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    ],
  },
  {
    // DB 에는 도메인 없는 경로(`/2026-11-18/uuid.webp`)만 둔다 — CDN 을 바꿔도 글을 안 고치게.
    // S3 를 켜고 키 방식 전환 전에 올라간 이미지는 전체 주소로 들어가 있어서 여기서 떼어낸다.
    // 이게 안 되면 uploads.url 과 본문 이미지 src 형식이 어긋나 "안 쓰인 이미지" 로 잘못 분류된다.
    name: '이미지 주소에서 CDN 도메인 떼기 (DB 엔 경로만)',
    check: async (c) => (await countAbsoluteImageUrls(c)) === 0,
    run: async (c) => {
      const base = cdnBase();
      const like = `%${base}%`;
      await c.query("UPDATE uploads SET url = REPLACE(url, ?, '') WHERE url LIKE ?", [base, like]);
      await c.query("UPDATE uploads SET thumb_url = REPLACE(thumb_url, ?, '') WHERE thumb_url LIKE ?", [base, like]);
      await c.query("UPDATE posts SET thumb_url = REPLACE(thumb_url, ?, '') WHERE thumb_url LIKE ?", [base, like]);
      await c.query("UPDATE news_articles SET thumb_url = REPLACE(thumb_url, ?, '') WHERE thumb_url LIKE ?", [base, like]);
      await c.query("UPDATE phone_specs SET thumb_url = REPLACE(thumb_url, ?, '') WHERE thumb_url LIKE ?", [base, like]);
      // 본문은 JSON 이라 문자열로 꺼내 바꾸고 다시 넣는다
      await c.query(
        `UPDATE posts
            SET content_json = CAST(REPLACE(CAST(content_json AS CHAR), ?, '') AS JSON)
          WHERE CAST(content_json AS CHAR) LIKE ?`,
        [base, like],
      );
    },
  },
  {
    // 기사·기종에 사진을 여러 장 붙인다(보통 1장, 가끔 2장). 순서가 의미를 가지므로 배열로 둔다.
    //
    // uploads.owner 가 같이 들어가는 이유가 중요하다 — 뒷정리(maintenance.ts)는
    // `post_id IS NULL` 인 업로드를 24시간 뒤에 지운다. 기사 사진은 글(posts)이 아니라
    // post_id 가 영영 NULL 이고, 그대로 두면 다음 날 사진이 사라진다.
    // posts 는 FK 가 걸린 post_id 를 그대로 쓰고, 그 밖의 콘텐츠는 owner('news:9')로 잡는다.
    name: 'news_articles/phone_specs.images + uploads.owner — 기사·기종 사진',
    check: (c) => hasColumn(c, 'uploads', 'owner'),
    sql: [
      `ALTER TABLE news_articles ADD COLUMN images JSON NULL COMMENT '[{url, caption}] — 순서가 곧 노출 순서'`,
      `ALTER TABLE phone_specs   ADD COLUMN images JSON NULL COMMENT '[{url, caption}] — 순서가 곧 노출 순서'`,
      `ALTER TABLE uploads
         ADD COLUMN owner VARCHAR(40) NULL COMMENT '글이 아닌 콘텐츠가 쓰는 중이면 news:9 / spec:3',
         ADD KEY idx_uploads_owner (owner)`,
    ],
  },
  {
    // 어느 지역 시세 글을 쓸지 고르는 목록. 네이버 검색광고 API 에서 받아 쌓는다.
    // 글을 쓴 지역은 done 으로 표시해 두고, 다음 달에 다시 쓰려면 풀면 된다.
    name: 'sise_keywords — 지역 키워드 검색량',
    check: (c) => hasTable(c, 'sise_keywords'),
    sql: [
      `CREATE TABLE sise_keywords (
         id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
         keyword    VARCHAR(60)  NOT NULL COMMENT '예: 수원휴대폰성지',
         place      VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '묶음 지역명. 시세표의 region 으로 쓴다',
         monthly    INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '월간검색수 (PC+모바일)',
         competition VARCHAR(10) NOT NULL DEFAULT '' COMMENT '네이버 경쟁정도',
         done       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '이 지역 글을 썼는지',
         done_at    DATETIME     NULL,
         fetched_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_sise_keywords_keyword (keyword),
         KEY idx_sise_keywords_rank (done, monthly DESC)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    ],
  },
  {
    // 제목 번역 + '삭제' 상태.
    // 삭제는 행을 지우지 않는다 — guid 가 UNIQUE 라 지우면 다음 수집 때 다시 들어온다.
    name: 'news_feed.title_ko + 삭제 상태 — 수집함 손질',
    check: (c) => hasColumn(c, 'news_feed', 'title_ko'),
    sql: [
      `ALTER TABLE news_feed
         ADD COLUMN title_ko VARCHAR(300) NULL COMMENT '한국어로 옮긴 제목. 원문 제목은 title 에 그대로 둔다'`,
      `ALTER TABLE news_feed
         MODIFY COLUMN status ENUM('수집','작성됨','숨김','삭제') NOT NULL DEFAULT '수집'`,
    ],
  },
  {
    // 안 쓸 키워드 치우기.
    // 행을 지우지 않는다 — keyword 가 UNIQUE 이고 조회할 지역(PLACES)이 고정이라,
    // 지워도 '검색량 가져오기' 를 누르면 같은 키워드가 그대로 다시 들어온다.
    name: 'sise_keywords.hidden — 안 쓸 지역 키워드 치우기',
    check: (c) => hasColumn(c, 'sise_keywords', 'hidden'),
    sql: [
      `ALTER TABLE sise_keywords
         ADD COLUMN hidden TINYINT(1) NOT NULL DEFAULT 0 COMMENT '안 쓸 키워드. 목록에서 빼지만 행은 남긴다'`,
    ],
  },
  {
    // 공지사항처럼 운영진만 쓰는 회원 글 게시판. 기본값 0 이라 기존 게시판은 그대로다.
    name: 'boards.admin_only — 관리자 전용 게시판',
    check: (c) => hasColumn(c, 'boards', 'admin_only'),
    sql: [
      `ALTER TABLE boards
         ADD COLUMN admin_only TINYINT(1) NOT NULL DEFAULT 0 COMMENT '운영진만 글쓰기' AFTER seller_only`,
    ],
  },
  {
    // 카카오 가입자는 이메일·비밀번호가 없다. UNIQUE 는 NULL 을 여러 개 허용하므로 그대로 둔다.
    name: 'users.kakao_id + phone_hash — 카카오 로그인 · 휴대폰 인증',
    check: (c) => hasColumn(c, 'users', 'kakao_id'),
    sql: [
      `ALTER TABLE users
         MODIFY email VARCHAR(255) NULL,
         MODIFY password_hash VARCHAR(255) NULL COMMENT 'scrypt: salt:hash (node:crypto)',
         ADD COLUMN kakao_id VARCHAR(32) NULL COMMENT '카카오 회원번호' AFTER password_hash,
         ADD COLUMN phone_hash CHAR(64) NULL AFTER kakao_id,
         ADD UNIQUE KEY uq_users_kakao (kakao_id),
         ADD UNIQUE KEY uq_users_phone (phone_hash)`,
    ],
  },
  {
    name: 'phone_verifications — 휴대폰 인증번호',
    check: (c) => hasTable(c, 'phone_verifications'),
    sql: [
      `CREATE TABLE phone_verifications (
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
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`,
    ],
  },
];

/** 공개 주소 앞머리. 없으면 바꿀 것도 없다. */
function cdnBase() {
  return (process.env.IMAGE_BASE_URL ?? '').replace(/\/+$/, '');
}

/** DB 에 전체 주소로 남아 있는 이미지가 몇 건인지 */
async function countAbsoluteImageUrls(conn) {
  const base = cdnBase();
  if (!base) return 0; // CDN 설정이 없으면 해당 없음
  const like = `%${base}%`;
  const checks = [
    ['uploads', 'url'],
    ['uploads', 'thumb_url'],
    ['posts', 'thumb_url'],
    ['news_articles', 'thumb_url'],
    ['phone_specs', 'thumb_url'],
  ];
  let total = 0;
  for (const [table, column] of checks) {
    if (!(await hasTable(conn, table))) continue;
    const [rows] = await conn.query(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE \`${column}\` LIKE ?`, [like]);
    total += Number(rows[0].n);
  }
  if (await hasTable(conn, 'posts')) {
    const [rows] = await conn.query('SELECT COUNT(*) AS n FROM posts WHERE CAST(content_json AS CHAR) LIKE ?', [like]);
    total += Number(rows[0].n);
  }
  return total;
}

async function hasColumn(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column],
  );
  return Number(rows[0].n) > 0;
}

async function hasTable(conn, table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  );
  return Number(rows[0].n) > 0;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL 이 없습니다. backend/.env.local 을 확인하세요.');
    process.exit(1);
  }

  const conn = await mysql.createConnection(url);
  try {
    const pending = [];
    for (const step of steps) {
      if (await step.check(conn)) console.log(`  이미 적용됨  ${step.name}`);
      else pending.push(step);
    }

    if (pending.length === 0) {
      console.log('\n✅ 적용할 변경이 없습니다.');
      return;
    }

    console.log('');
    for (const step of pending) console.log(`  적용 필요    ${step.name}`);

    if (!confirmed) {
      console.log('\n실제로 적용하려면: npm run db:migrate -- --yes');
      return;
    }

    console.log('');
    for (const step of pending) {
      // 스키마 변경은 sql 배열로, 데이터 손질은 run() 으로
      if (step.run) await step.run(conn);
      else for (const sql of step.sql) await conn.query(sql);
      console.log(`  ✔ ${step.name}`);
    }
    console.log('\n✅ 적용 완료');
  } finally {
    await conn.end();
  }
}

await main();
