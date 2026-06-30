import mysql from 'mysql2/promise';

export const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DBPORT || 3306),
  user: 'root',
  password: process.env.DBPWD || '',
  database: process.env.SHEMA,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: '+09:00',
  dateStrings: true,
});

// 새 풀 연결마다 세션 타임존을 KST(+09:00) 로 고정.
// → MySQL 서버가 UTC 로 돌아가도 NOW() / CURRENT_TIMESTAMP 가 KST 를 반환.
// → DATETIME 컬럼(scheduled_at 등) 비교가 사용자가 보는 시각 그대로 동작.
// pool 옵션의 `timezone` 은 Date 직렬화/역직렬화에만 적용되고 서버 함수에는 영향이 없어서 따로 SET 필요.
db.on('connection', (connection) => {
  connection.query("SET time_zone = '+09:00'");
});
