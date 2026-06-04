import fp from 'fastify-plugin';
import mysql from 'mysql2/promise';

declare module 'fastify' {
  interface FastifyInstance {
    db: mysql.Pool;
  }
}

// MySQL 커넥션 풀을 fastify.db 로 데코레이트한다.
export default fp(
  async (app) => {
    const pool = mysql.createPool({
      host: app.config.DB_HOST,
      port: app.config.DB_PORT,
      user: app.config.DB_USER,
      password: app.config.DB_PASSWORD,
      database: app.config.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
      timezone: '+09:00',
      dateStrings: true,
    });

    // 부팅 시 연결 확인
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    app.log.info('MySQL connected');

    app.decorate('db', pool);

    app.addHook('onClose', async (instance) => {
      await instance.db.end();
    });
  },
  { name: 'db', dependencies: ['env'] },
);
