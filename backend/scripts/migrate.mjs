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
];

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
      for (const sql of step.sql) await conn.query(sql);
      console.log(`  ✔ ${step.name}`);
    }
    console.log('\n✅ 적용 완료');
  } finally {
    await conn.end();
  }
}

await main();
