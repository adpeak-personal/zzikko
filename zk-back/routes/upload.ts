import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { tmpKey, uploadBuffer, BUCKET_NAME } from '../lib/gcs';

export default async function uploadRoutes(app: FastifyInstance) {
  // POST /api/upload/image  — 이미지 업로드 (인증 필요, multipart)
  app.post('/image', { preHandler: app.authenticate }, async (req, reply) => {
    if (!BUCKET_NAME) return reply.internalServerError('GCS_BUCKET 이 설정되지 않았습니다.');

    const file = await req.file();
    if (!file) return reply.badRequest('이미지 파일이 필요합니다.');
    if (!file.mimetype.startsWith('image/')) {
      return reply.badRequest('이미지 파일만 업로드할 수 있습니다.');
    }

    // fileSize 한도(main.ts limits: 10MB) 초과 시 toBuffer() 가 413 에러를 throw 한다.
    let input: Buffer;
    try {
      input = await file.toBuffer();
    } catch {
      return reply.code(413).send({ message: '이미지 용량이 너무 큽니다. (최대 10MB)' });
    }

    let output: Buffer;
    try {
      // 최적화: EXIF 회전 보정 → 최대 1600px(확대 안 함) → webp(q80)
      output = await sharp(input)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      return reply.badRequest('이미지를 처리할 수 없습니다. (손상되었거나 지원하지 않는 형식)');
    }

    const url = await uploadBuffer(tmpKey('webp'), output, 'image/webp');
    req.log.info({ url }, '이미지 업로드');
    return { url };
  });
}
