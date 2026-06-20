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
