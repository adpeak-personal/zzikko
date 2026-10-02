import './env.js'; // 다른 import 보다 먼저 — 환경변수를 읽는다
import { buildApp } from './app.js';
import { closePool } from './db/pool.js';

const port = Number(process.env.PORT ?? 4080);
// 로컬은 루프백만. 컨테이너로 띄울 때는 HOST=0.0.0.0 을 준다.
const host = process.env.HOST ?? '127.0.0.1';

const app = await buildApp();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await closePool();
    process.exit(0);
  });
}

await app.listen({ port, host });
