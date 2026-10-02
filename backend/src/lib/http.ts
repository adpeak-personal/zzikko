import type { FastifyReply } from 'fastify';
import { ZodError, type ZodType } from 'zod';

/** 라우트에서 던지면 그대로 응답이 되는 오류 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what = '요청하신 내용') => new HttpError(404, `${what}을(를) 찾을 수 없습니다.`);
export const badRequest = (message = '입력값을 확인해주세요.') => new HttpError(400, message);
export const unauthorized = (message = '로그인이 필요합니다.') => new HttpError(401, message);
export const forbidden = (message = '권한이 없습니다.') => new HttpError(403, message);

/**
 * zod 로 입력을 검증한다.
 * 실패하면 어느 항목이 왜 틀렸는지 함께 돌려준다 — 화면에서 그대로 보여줄 수 있게.
 */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
      const err = new HttpError(400, '입력값을 확인해주세요.');
      (err as HttpError & { issues?: unknown }).issues = issues;
      throw err;
    }
    throw error;
  }
}

export function sendError(reply: FastifyReply, error: unknown) {
  if (error instanceof HttpError) {
    const issues = (error as HttpError & { issues?: unknown }).issues;
    return reply.code(error.status).send({ message: error.message, ...(issues ? { issues } : {}) });
  }
  // Fastify 가 던지는 에러(본문 파싱 실패, 파일 용량 초과 등)는 자기 상태코드를 들고 있다.
  // 그대로 500 으로 덮으면 "서버가 고장났다"로 보여서 원인을 찾기 어렵다.
  const status = (error as { statusCode?: number })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    reply.log.warn(error);
    return reply.code(status).send({ message: (error as Error).message });
  }

  reply.log.error(error);
  return reply.code(500).send({ message: '요청을 처리하지 못했습니다.' });
}
