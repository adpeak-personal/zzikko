import type { FastifyInstance } from 'fastify';

export default async function healthRoutes(app: FastifyInstance) {
  // 서버 헬스체크
  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  // DB 연결까지 확인하는 헬스체크
  app.get('/health/db', async () => {
    const [rows] = await app.db.query('SELECT 1 AS ok');
    return { status: 'ok', db: rows };
  });
}
