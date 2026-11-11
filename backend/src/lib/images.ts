/**
 * 업로드 이미지 가공 — webp 변환 + EXIF 제거.
 *
 * sharp 는 `withMetadata()` 를 부르지 않는 한 메타데이터를 **버린다**.
 * 그래서 GPS 좌표가 담긴 EXIF 가 자동으로 사라진다 — 휴대폰으로 찍은 사진을
 * 그대로 올리는 커뮤니티라서, 집 위치가 사진에 묻어 공개되는 걸 막는 게 중요하다.
 *
 * 썸네일은 여기서 만들지 않는다. 목록 썸네일로 쓰이는 건 **글의 첫 이미지 하나뿐**이라,
 * 올리는 족족 만들면 나머지는 아무도 안 보는 파일이 된다. 글을 등록할 때
 * `lib/thumbnail.ts` 가 첫 이미지에 대해서만 만든다.
 */
import sharp from 'sharp';

/** 본문용 긴 변 최대 픽셀 */
const VIEW_MAX_EDGE = 1600;
const VIEW_QUALITY = 82;

/** 목록 썸네일 */
export const THUMB_MAX_EDGE = 400;
const THUMB_QUALITY = 75;

export interface ProcessedImage {
  body: Buffer;
  width: number;
  height: number;
  bytes: number;
}

export class UnsupportedImageError extends Error {}

/** 애니메이션 GIF 는 webp 로 바꾸면 첫 프레임만 남아서 따로 다룬다 */
export async function isAnimated(input: Buffer): Promise<boolean> {
  try {
    const meta = await sharp(input).metadata();
    return (meta.pages ?? 1) > 1;
  } catch {
    return false;
  }
}

async function resize(input: Buffer, maxEdge: number, quality: number): Promise<ProcessedImage> {
  const body = await sharp(input)
    .rotate() // EXIF 방향만 반영하고 메타데이터 자체는 버린다
    .resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();

  const out = await sharp(body).metadata();
  return { body, width: out.width ?? 0, height: out.height ?? 0, bytes: body.byteLength };
}

/** 업로드된 이미지를 본문용 webp 로 변환한다 (원본보다 키우지 않는다) */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  try {
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height) throw new UnsupportedImageError('이미지 크기를 확인할 수 없습니다.');
  } catch (err) {
    if (err instanceof UnsupportedImageError) throw err;
    throw new UnsupportedImageError('이미지를 읽을 수 없습니다.');
  }

  return resize(input, VIEW_MAX_EDGE, VIEW_QUALITY);
}

/**
 * 썸네일 한 장 — 글 등록 시 첫 이미지에 쓴다.
 *
 * 원본이 아니라 이미 저장된 본문용 이미지를 줄인다. 400px 로 갈 거라 1600px 짜리로
 * 충분하고, 원본을 따로 보관하지 않기 때문이다.
 */
export const makeThumb = (viewImage: Buffer) => resize(viewImage, THUMB_MAX_EDGE, THUMB_QUALITY);
