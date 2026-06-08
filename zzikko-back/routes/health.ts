import type { FastifyInstance } from 'fastify';

export default async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    return { status: 'ok', uptime: process.uptime() };
  });

  app.get('/health/db', async () => {
    const [rows] = await app.db.query('SELECT 1 AS ok');
    return { status: 'ok', db: rows };
  });
}
