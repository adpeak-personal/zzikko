import 'dotenv/config';

import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import fastifyJwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import type mysql from 'mysql2/promise';
import { db } from './lib/db';
import { type TokenStore } from './lib/token-store';
import { DbTokenStore } from './lib/db-token-store';
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import postRoutes from './routes/posts';
import ogRoutes from './routes/og';
import uploadRoutes from './routes/upload';

declare module 'fastify' {
  interface FastifyInstance {
    db: mysql.Pool;
    tokens: TokenStore;
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: number; role: string; type: 'access' | 'refresh' };
    user: { sub: number; role: string; type: 'access' | 'refresh' };
  }
}

const app = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === 'production'
        ? undefined
        : { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } },
  },
});

app.register(cors, {
  origin: (process.env.CORS_ORIGIN || 'http://localhost:3040').split(',').map((o) => o.trim()),
  credentials: true,
});
app.register(sensible);
app.register(fastifyJwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });
app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

app.decorate('db', db);
app.decorate('tokens', new DbTokenStore(db));
app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
  try {
    await req.jwtVerify();
    if (req.user.type !== 'access') {
      return reply.unauthorized('access 토큰이 아닙니다.');
    }
  } catch {
    return reply.unauthorized('인증이 필요합니다.');
  }
});

app.register(healthRoutes);
app.register(authRoutes, { prefix: '/api/auth' });
app.register(userRoutes, { prefix: '/api/users' });
app.register(postRoutes, { prefix: '/api/posts' });
app.register(ogRoutes, { prefix: '/api' });
app.register(uploadRoutes, { prefix: '/api/upload' });

const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';

const start = async () => {
  try {
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
