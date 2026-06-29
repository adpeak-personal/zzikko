// blog_jobs / blog_job_keywords 테이블 1회용 마이그레이션 스크립트
//
// 실행:
//   cd zk-back
//   npx ts-node-dev --transpile-only scripts/migrate-blog-jobs.ts
//
// 멱등성:
//   CREATE TABLE IF NOT EXISTS 를 사용하므로 여러 번 실행해도 안전.
//   단, 이미 다른 형태로 같은 이름 테이블이 있다면 손대지 않음 — 그 경우 수동 DROP 후 재실행.

import 'dotenv/config';
import { db } from '../lib/db';

const BLOG_JOBS_SQL = `
CREATE TABLE IF NOT EXISTS \`blog_jobs\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`title\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`scheduled_at\` datetime NOT NULL,
  \`status\` enum('PENDING','PROCESSING','DONE','FAILED') COLLATE utf8mb4_unicode_ci DEFAULT 'PENDING',
  \`result_url\` varchar(511) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`error\` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`published_at\` timestamp NULL DEFAULT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`idx_status_schedule\` (\`status\`,\`scheduled_at\`),
  KEY \`idx_title_recent\` (\`title\`,\`created_at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const BLOG_JOB_KEYWORDS_SQL = `
CREATE TABLE IF NOT EXISTS \`blog_job_keywords\` (
  \`id\` int NOT NULL AUTO_INCREMENT,
  \`job_id\` int NOT NULL,
  \`keyword\` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`created_at\` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`uq_job_keyword\` (\`job_id\`,\`keyword\`),
  KEY \`idx_keyword_recent\` (\`keyword\`,\`created_at\`),
  CONSTRAINT \`blog_job_keywords_ibfk_1\`
    FOREIGN KEY (\`job_id\`) REFERENCES \`blog_jobs\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function run() {
  console.log('▶ blog_jobs 생성 중…');
  await db.query(BLOG_JOBS_SQL);
  console.log('  ✓ blog_jobs OK');

  console.log('▶ blog_job_keywords 생성 중…');
  await db.query(BLOG_JOB_KEYWORDS_SQL);
  console.log('  ✓ blog_job_keywords OK');

  // 실제 생성 확인
  const [rows] = await db.query<Array<{ TABLE_NAME: string }> & object[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME IN ('blog_jobs','blog_job_keywords')`,
    [process.env.SHEMA],
  );
  console.log('▶ 확인:', (rows as Array<{ TABLE_NAME: string }>).map((r) => r.TABLE_NAME));
}

run()
  .then(() => {
    console.log('🎉 완료');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ 실패:', err);
    process.exit(1);
  });
