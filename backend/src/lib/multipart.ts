import type { FastifyRequest } from 'fastify';
import { badRequest } from './http.js';

/**
 * 멀티파트로 올라온 파일을 버퍼로 읽는다.
 *
 * sharp 도, AI 호출도 전체 바이트를 필요로 하므로 스트림을 그대로 넘길 수 없다.
 */

/** @fastify/multipart 의 용량 제한과 맞춘다 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function readAll(stream: AsyncIterable<Buffer>, limit: number) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of stream) {
    total += chunk.byteLength;
    if (total > limit) return null; // 초과분은 더 읽지 않는다
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * 이미지 한 장을 받아 버퍼로 돌려준다.
 *
 * 확장자가 아니라 mimetype 으로 거른다 — 저장 이름은 서버가 다시 만들기 때문에
 * 올라온 파일 이름은 보지 않는다.
 */
export async function readImage(request: FastifyRequest, missing: string): Promise<{ data: Buffer; mimetype: string }> {
  const file = await request.file();
  if (!file) throw badRequest(missing);
  if (!file.mimetype.startsWith('image/')) throw badRequest('이미지 파일만 올릴 수 있습니다.');

  const data = await readAll(file.file, MAX_UPLOAD_BYTES);
  if (!data || file.file.truncated) throw badRequest('이미지는 10MB 까지 올릴 수 있습니다.');

  return { data, mimetype: file.mimetype };
}
