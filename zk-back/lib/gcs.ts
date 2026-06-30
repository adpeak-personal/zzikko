import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Storage } from '@google-cloud/storage';
import sharp from 'sharp';

// 서비스 계정 키 파일 경로 (.env 의 GCS_KEY_FILE, 기본값은 프로젝트 루트의 키)
const keyFilename =
  process.env.GCS_KEY_FILE || path.join(__dirname, '..', 'community-gcs-key.json');

export const BUCKET_NAME = process.env.GCS_BUCKET || '';

const storage = new Storage({ keyFilename });
export const bucket = storage.bucket(BUCKET_NAME);

/** 공개 객체 URL */
export function publicUrl(key: string): string {
  return `https://storage.googleapis.com/${BUCKET_NAME}/${key}`;
}

/** YYYY/MM/DD */
function datePath(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

/** 임시 업로드 키: tmp/YYYY/MM/DD/{uuid}.{ext} */
export function tmpKey(ext: string): string {
  return `tmp/${datePath()}/${randomUUID()}.${ext}`;
}

/** 버퍼를 GCS 에 업로드하고 공개 URL 반환 */
export async function uploadBuffer(
  key: string,
  buf: Buffer,
  contentType: string,
): Promise<string> {
  await bucket.file(key).save(buf, {
    contentType,
    resumable: false,
    metadata: {
      // 파일명이 uuid 라 내용이 절대 안 바뀜 → 1년 immutable 캐시
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });
  return publicUrl(key);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 본문 HTML 의 첫 번째 이미지로 썸네일(webp)을 만들어 GCS 에 올리고 공개 URL 을 반환한다.
 * - 글 작성 시 호출 → 목록 썸네일로 사용 (thumbnail_url 컬럼에 저장).
 * - 본문에 이미지가 없거나 이 버킷 이미지가 아니면 null.
 *
 * @param destPrefix 저장될 GCS 경로 prefix. 게시판별 폴더 분리에 사용 (e.g. 'blog', 'posts', 'community')
 */
export async function generateThumbnail(
  html: string,
  destPrefix: string = 'posts',
): Promise<string | null> {
  if (!BUCKET_NAME || !html) return null;

  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!m) return null;

  const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
  const src = m[1];
  if (!src.startsWith(prefix)) return null; // 이 버킷 이미지가 아니면 스킵

  const srcKey = decodeURIComponent(src.slice(prefix.length));
  try {
    // GCS 에서 원본을 받아 → 최대 600px webp 로 축소 → {destPrefix}/{date}/thumb_*.webp 로 업로드
    const [buf] = await bucket.file(srcKey).download();
    const thumb = await sharp(buf)
      .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    const key = `${destPrefix}/${datePath()}/thumb_${randomUUID()}.webp`;
    return await uploadBuffer(key, thumb, 'image/webp');
  } catch {
    return null;
  }
}

/**
 * 주어진 문자열들(본문/썸네일/extra_data 등) 안에서 이 버킷의 객체 URL을 모두 찾아
 * GCS 에서 삭제한다. (글 삭제 시 호출 → 고아 이미지 0)
 * - 존재하지 않거나 실패한 파일은 무시한다(idempotent).
 */
export async function deleteStoredImages(...texts: (string | null | undefined)[]): Promise<void> {
  if (!BUCKET_NAME) return;

  const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/`;
  const re = new RegExp(`${escapeRegExp(prefix)}([^\\s"'<>)]+)`, 'g');

  const keys = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const m of text.matchAll(re)) keys.add(decodeURIComponent(m[1]));
  }
  if (keys.size === 0) return;

  await Promise.all(
    [...keys].map((key) =>
      bucket.file(key).delete({ ignoreNotFound: true }).catch(() => {}),
    ),
  );
}

/**
 * 본문(또는 임의 문자열) 안의 tmp/ 이미지들을 {destPrefix}/ 로 이동하고
 * URL 을 영구 경로로 치환한 문자열을 반환한다.
 * - 글 저장 시 호출 → 영구 폴더에는 실제로 글에 쓰인 이미지만 남는다(고아 0).
 * - 저장 안 된(취소된) tmp/ 이미지는 그대로 남아 Lifecycle 규칙으로 자동 삭제.
 *
 * @param destPrefix 저장될 GCS 경로 prefix. 게시판별 폴더 분리에 사용 (e.g. 'blog', 'posts', 'community')
 */
export async function finalizeTmpUrls(html: string, destPrefix: string = 'posts'): Promise<string> {
  if (!html || !BUCKET_NAME) return html;

  const prefix = `https://storage.googleapis.com/${BUCKET_NAME}/tmp/`;
  const re = new RegExp(`${escapeRegExp(prefix)}([^\\s"'<>)]+)`, 'g');

  // 중복 URL 제거 (같은 이미지가 본문에 여러 번 나와도 한 번만 이동)
  const rests = new Set<string>();
  for (const m of html.matchAll(re)) rests.add(m[1]); // rest = YYYY/MM/DD/uuid.ext
  if (rests.size === 0) return html;

  let result = html;
  for (const rest of rests) {
    const srcKey = `tmp/${rest}`;
    const destKey = `${destPrefix}/${rest}`;
    try {
      await bucket.file(srcKey).move(destKey);
    } catch {
      // 이미 이동됐거나 존재하지 않으면 무시 (idempotent)
    }
    result = result.split(prefix + rest).join(publicUrl(destKey));
  }
  return result;
}
