import fp from 'fastify-plugin';
import fastifyEnv from '@fastify/env';

// .env / 환경변수 스키마 — 부팅 시점에 검증한다.
const schema = {
  type: 'object',
  required: ['DB_HOST', 'DB_USER', 'DB_NAME'],
  properties: {
    NODE_ENV: { type: 'string', default: 'development' },
    PORT: { type: 'number', default: 4000 },
    HOST: { type: 'string', default: '0.0.0.0' },
    CORS_ORIGIN: { type: 'string', default: 'http://localhost:3000' },

    DB_HOST: { type: 'string' },
    DB_PORT: { type: 'number', default: 3306 },
    DB_USER: { type: 'string' },
    DB_PASSWORD: { type: 'string', default: '' },
    DB_NAME: { type: 'string' },

    // JWT
    JWT_SECRET: { type: 'string', default: 'dev-secret-change-me' },
    JWT_ACCESS_EXPIRES: { type: 'string', default: '1h' },
    JWT_REFRESH_EXPIRES: { type: 'string', default: '14d' },

    // Kakao OAuth
    KAKAO_REST_API_KEY: { type: 'string', default: '' },
    KAKAO_CLIENT_SECRET: { type: 'string', default: '' },
    KAKAO_REDIRECT_URI: { type: 'string', default: 'http://localhost:3000/auth/kakao' },
  },
} as const;

export interface AppConfig {
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  CORS_ORIGIN: string;
  DB_HOST: string;
  DB_PORT: number;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  JWT_SECRET: string;
  JWT_ACCESS_EXPIRES: string;
  JWT_REFRESH_EXPIRES: string;
  KAKAO_REST_API_KEY: string;
  KAKAO_CLIENT_SECRET: string;
  KAKAO_REDIRECT_URI: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export default fp(
  async (app) => {
    await app.register(fastifyEnv, {
      confKey: 'config',
      schema,
      dotenv: true,
    });
  },
  { name: 'env' },
);
