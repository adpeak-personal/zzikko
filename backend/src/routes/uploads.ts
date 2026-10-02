import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { badRequest } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { saveFile } from '../lib/storage.js';
import { execute } from '../db/pool.js';

const ALLOWED: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

export default async function uploadRoutes(app: FastifyInstance) {
  /**
   * 이미지 업로드.
   *
   * 저장 이름과 확장자는 서버가 정한다 — 올라온 파일 이름을 그대로 쓰면
   * `../` 같은 경로나 `.html` 확장자가 섞여 들어올 수 있다.
   * 저장 위치(GCS / 로컬)는 lib/storage.ts 가 환경변수를 보고 고른다.
   */
  app.post('/uploads/image', { preHandler: requireAuth }, async (request, reply) => {
    const file = await request.file();
    if (!file) throw badRequest('이미지를 선택해주세요.');

    const extension = ALLOWED[file.mimetype];
    if (!extension) throw badRequest('JPG · PNG · GIF · WEBP 만 올릴 수 있습니다.');

    // 날짜 폴더로 나눠 한 폴더에 파일이 수만 개 쌓이지 않게 한다
    const today = new Date().toISOString().slice(0, 10);
    const objectPath = `${today}/${randomUUID()}${extension}`;

    const saved = await saveFile(objectPath, file.file, file.mimetype);

    // @fastify/multipart 가 용량 제한을 넘기면 파일이 잘린 채로 끝난다
    if (file.file.truncated) throw badRequest('이미지는 10MB 까지 올릴 수 있습니다.');

    await execute('INSERT INTO uploads (url, filename, mimetype, size, uploader_id) VALUES (?, ?, ?, ?, ?)', [
      saved.url,
      file.filename.slice(0, 255),
      file.mimetype,
      file.file.bytesRead,
      request.user.id,
    ]);

    return reply.code(201).send({
      url: saved.url,
      filename: file.filename,
      mimetype: file.mimetype,
      size: file.file.bytesRead,
    });
  });
}
