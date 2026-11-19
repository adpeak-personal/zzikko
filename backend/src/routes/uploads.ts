import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { badRequest } from '../lib/http.js';
import { requireAuth } from '../lib/auth.js';
import { saveBuffer, toStored } from '../lib/storage.js';
import { UnsupportedImageError, isAnimated, processImage } from '../lib/images.js';
import { MAX_UPLOAD_BYTES, readAll } from '../lib/multipart.js';
import { recordUpload } from '../repositories/uploads.js';

const ALLOWED: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

/** 날짜 폴더로 나눠 한 폴더에 파일이 수만 개 쌓이지 않게 한다 */
const todayFolder = () => new Date().toISOString().slice(0, 10);

export default async function uploadRoutes(app: FastifyInstance) {
  /**
   * 이미지 업로드.
   *
   * 저장 이름과 확장자는 서버가 정한다 — 올라온 파일 이름을 그대로 쓰면
   * `../` 같은 경로나 `.html` 확장자가 섞여 들어올 수 있다.
   * 저장 위치(GCS / 로컬)는 lib/storage.ts 가 환경변수를 보고 고른다.
   *
   * 이미지는 webp 로 변환해 저장한다. 용량이 줄기도 하지만, 변환 과정에서
   * EXIF(촬영 위치 포함)가 사라지는 게 더 중요하다 — lib/images.ts 참고.
   */
  app.post('/uploads/image', { preHandler: requireAuth }, async (request, reply) => {
    const file = await request.file();
    if (!file) throw badRequest('이미지를 선택해주세요.');

    const extension = ALLOWED[file.mimetype];
    if (!extension) throw badRequest('JPG · PNG · GIF · WEBP 만 올릴 수 있습니다.');

    const input = await readAll(file.file, MAX_UPLOAD_BYTES);
    if (!input || file.file.truncated) throw badRequest('이미지는 10MB 까지 올릴 수 있습니다.');

    const id = randomUUID();
    const folder = todayFolder();

    // 애니메이션 GIF 는 webp 로 바꾸면 첫 프레임만 남는다 — 원본 그대로 저장
    if (await isAnimated(input)) {
      const saved = await saveBuffer(`${folder}/${id}${extension}`, input, file.mimetype);
      await recordUpload({
        // DB 에는 도메인 없는 경로만 — 응답은 아래에서 전체 주소로 준다
        url: toStored(saved.url),
        filename: file.filename,
        mimetype: file.mimetype,
        size: input.byteLength,
        uploaderId: request.user!.id,
      });
      return reply.code(201).send({
        url: saved.url,
        filename: file.filename,
        mimetype: file.mimetype,
        size: input.byteLength,
        animated: true,
      });
    }

    let processed;
    try {
      processed = await processImage(input);
    } catch (err) {
      if (err instanceof UnsupportedImageError) throw badRequest(err.message);
      throw err;
    }

    const saved = await saveBuffer(`${folder}/${id}.webp`, processed.body, 'image/webp');

    // post_id 없이 기록해 둔다 — 글에 안 쓰이면 나중에 청소 대상이 된다
    await recordUpload({
      // DB 에는 도메인 없는 경로만 — 응답은 아래에서 전체 주소로 준다
      url: toStored(saved.url),
      filename: file.filename,
      mimetype: 'image/webp',
      size: processed.bytes,
      uploaderId: request.user!.id,
      width: processed.width,
      height: processed.height,
    });

    return reply.code(201).send({
      url: saved.url,
      filename: file.filename,
      mimetype: 'image/webp',
      size: processed.bytes,
      width: processed.width,
      height: processed.height,
    });
  });
}
