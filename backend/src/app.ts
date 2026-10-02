import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { sendError } from './lib/http.js';
import { loadUser } from './lib/auth.js';
import routes from './routes/index.js';
import { UPLOAD_DIR, storageDescription, usingGcs } from './lib/storage.js';

/**
 * 모든 API 는 /api/v1 아래에 있다.
 * 웹(Next.js)과 이후 Flutter 앱이 같은 API 를 쓴다.
 */
export async function buildApp({ logger = true } = {}) {
  const app = Fastify({ logger });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:4050'],
    credentials: true, // 로그인 쿠키를 주고받아야 한다
  });

  await app.register(cookie);

  // 기본값을 두지 않는다 — 아무나 아는 키로 로그인 토큰이 서명되는 게 더 위험하다
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET 이 없습니다. .env.local 에 넣어 주세요 (.env.example 참고).');
  }

  await app.register(jwt, {
    secret: jwtSecret,
    sign: { expiresIn: '14d' },
  });

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  // GCS 를 쓰면 이미지 주소가 버킷을 가리키므로 여기서 서빙할 필요가 없다
  if (!usingGcs) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await app.register(fastifyStatic, {
      root: join(process.cwd(), UPLOAD_DIR),
      prefix: '/uploads/',
      decorateReply: false,
    });
  }
  app.log.info(`업로드 저장 위치: ${storageDescription()}`);

  // 모든 요청에서 쿠키를 확인해 request.user 를 채운다 (없으면 비로그인)
  app.addHook('preHandler', loadUser);

  app.setErrorHandler((error, _request, reply) => sendError(reply, error));
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ message: '없는 주소입니다.' }));

  await app.register(routes, { prefix: '/api/v1' });

  return app;
}
