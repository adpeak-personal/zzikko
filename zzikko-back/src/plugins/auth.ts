import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { InMemoryTokenStore, type TokenStore } from '../lib/token-store.js';

export interface JwtPayload {
  sub: number; // user id
  role: string;
  type: 'access' | 'refresh';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    // 라우트 preHandler 로 사용 — access 토큰을 검증하고 request.user 채움
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    // 토큰 저장소 (지금은 in-memory, 추후 Redis)
    tokens: TokenStore;
  }
}

export default fp(
  async (app) => {
    await app.register(fastifyJwt, {
      secret: app.config.JWT_SECRET,
    });

    // TODO(redis): Redis 준비되면 이 한 줄만 RedisTokenStore 로 교체
    app.decorate('tokens', new InMemoryTokenStore());

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
  },
  { name: 'auth', dependencies: ['env'] },
);
