import { createWriteStream } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

/**
 * 업로드 파일 저장소.
 *
 * AWS 설정이 있으면 S3(+CloudFront)로, 없으면 로컬 디스크로 저장한다.
 * 키가 준비되기 전에도 개발이 멈추지 않게 하려는 것이고, 어느 쪽이든
 * 돌려주는 값은 `url` 하나뿐이라 호출부(라우트)는 저장 위치를 모른다.
 *
 * 필요한 환경변수 (넷 다 있으면 S3 사용):
 *   S3_BUCKET              버킷 이름   예: zzikko-img-590427064205-ap-northeast-2-an
 *   AWS_REGION             리전        예: ap-northeast-2
 *   AWS_ACCESS_KEY_ID      액세스 키   (zzikko-img-uploader IAM 사용자)
 *   AWS_SECRET_ACCESS_KEY  시크릿 키
 *
 *   IMAGE_BASE_URL         (선택) CloudFront 주소. 예: https://dxxxx.cloudfront.net
 *                          없으면 S3 주소를 직접 쓴다 — CDN 만들기 전에도 동작하게.
 *   IMAGE_LEGACY_BASE_URLS (선택) 예전 공개 주소들, 쉼표로 구분.
 *                          CDN 도메인을 바꿨을 때 DB 에 남은 옛 주소를 읽기 위한 것.
 */

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? 'uploads';

/** 로컬 저장소일 때 백엔드가 직접 서빙하는 prefix */
const LOCAL_PREFIX = '/uploads/';

const bucket = process.env.S3_BUCKET;
const region = process.env.AWS_REGION;
const hasCredentials = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

/** S3 를 쓰는지 — app.ts 가 로컬 정적 서빙을 걸지 말지 판단하는 데 쓴다 */
export const usingRemoteStorage = Boolean(bucket && region && hasCredentials);

// 자격증명은 SDK 가 환경변수(AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)에서 알아서 읽는다
const client = usingRemoteStorage ? new S3Client({ region }) : null;

/** 공개 주소의 앞머리 (뒤 슬래시 없음) */
function publicBase(): string {
  const configured = process.env.IMAGE_BASE_URL?.replace(/\/+$/, '');
  if (configured) return configured;
  // CloudFront 를 아직 안 만들었을 때 — 버킷을 직접 가리킨다
  if (bucket && region) return `https://${bucket}.s3.${region}.amazonaws.com`;
  return LOCAL_PREFIX.replace(/\/+$/, '');
}

/** 지금 주소 + 예전 주소들 — 읽을 때는 둘 다 받아준다 */
function knownBases(): string[] {
  const legacy = (process.env.IMAGE_LEGACY_BASE_URLS ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return [publicBase(), ...legacy];
}

export interface SavedFile {
  /** 본문·썸네일에 넣을 주소 */
  url: string;
  /** 저장 경로 (버킷 안 키 또는 로컬 상대경로) */
  path: string;
}

/**
 * 버퍼를 저장한다.
 *
 * 쓰기 경로는 이것 하나다. 이미지는 sharp 로 가공하느라 어차피 전체를 메모리에
 * 올려야 해서(10MB 제한) 스트림으로 받을 이유가 없다.
 */
export async function saveBuffer(objectPath: string, body: Buffer, contentType: string): Promise<SavedFile> {
  if (client && bucket) {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectPath,
        Body: body,
        ContentType: contentType,
        // 키에 UUID 가 있어 같은 주소의 내용이 바뀌지 않는다 — CDN 에서 길게 캐시해도 안전하다
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    return { url: `${publicBase()}/${objectPath}`, path: objectPath };
  }

  // 로컬 디스크 — 백엔드가 /uploads/ 로 그대로 서빙한다
  const target = join(UPLOAD_DIR, objectPath);
  await mkdir(join(target, '..'), { recursive: true });
  await pipeline(Readable.from(body), createWriteStream(target));
  return { url: `${LOCAL_PREFIX}${objectPath}`, path: target };
}

/**
 * 저장된 파일을 다시 읽는다. 없으면 null.
 *
 * 글을 등록할 때 첫 이미지의 썸네일을 만들려면 저장해 둔 본문용 이미지가 필요하다.
 */
export async function readFileAt(objectPath: string): Promise<Buffer | null> {
  try {
    if (client && bucket) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: objectPath }));
      if (!result.Body) return null;
      return Buffer.from(await result.Body.transformToByteArray());
    }
    return await readFile(join(UPLOAD_DIR, objectPath));
  } catch {
    // 없는 파일(NoSuchKey/ENOENT)도 예외로 온다 — 부르는 쪽은 "없음" 으로만 알면 된다
    return null;
  }
}

/**
 * 주소 → 저장 경로(키).
 *
 * 받는 값은 세 가지다.
 *   `/2026-11-18/uuid.webp`            DB 에 저장된 형태 (도메인 없음)
 *   `https://cdn/2026-11-18/uuid.webp` 공개 주소 (지금 것 또는 IMAGE_LEGACY_BASE_URLS 의 옛 것)
 *   `/uploads/2026-10-01/uuid.webp`    S3 이전에 로컬 디스크로 올라간 파일
 *
 * 예전 주소도 받아주는 이유 — CDN 도메인을 바꿨을 때 DB 에 남은 옛 주소의
 * 이미지를 못 지우면 쓰레기가 영구히 쌓인다.
 */
export function toObjectPath(url: string): string | null {
  for (const base of knownBases()) {
    if (base && url.startsWith(`${base}/`)) return url.slice(base.length + 1);
  }
  if (url.startsWith(LOCAL_PREFIX)) return url.slice(LOCAL_PREFIX.length);
  // 남의 주소는 건드리지 않는다 (본문에 외부 이미지가 들어올 수 있다)
  if (/^https?:\/\//i.test(url)) return null;
  // 도메인 없는 우리 경로 — 앞 슬래시만 떼면 키다
  if (url.startsWith('/')) return url.slice(1);
  return null;
}

/* ── DB 에 넣는 값 ↔ 화면에 쓰는 주소 ──────────────────────────────
 *
 * DB 에는 도메인 없는 경로(`/2026-11-18/uuid.webp`)만 넣는다.
 * CDN 도메인이 바뀌어도 글 본문을 건드릴 필요가 없기 때문이다.
 *
 * 변환은 repositories / routes 경계에서만 한다 — 프론트는 늘 전체 주소만 본다.
 */

/** 화면에 쓸 주소 → DB 에 넣을 값 */
export function toStored(url: string): string {
  // S3 이전에 올라간 파일은 그대로 둔다. 파일이 아직 서버 디스크에 있어서
  // 키로 바꾸면 S3 에서 찾게 되고, 그럼 안 뜬다.
  if (url.startsWith(LOCAL_PREFIX)) return url;
  const key = toObjectPath(url);
  return key ? `/${key}` : url; // 우리 게 아니면(외부 이미지) 그대로
}

/** DB 에 든 값 → 화면에 쓸 주소 */
export function publicUrl(stored: string): string {
  if (/^https?:\/\//i.test(stored)) return stored; // 외부 이미지
  if (stored.startsWith(LOCAL_PREFIX)) return stored; // S3 이전 파일
  if (!stored.startsWith('/')) return stored; // 우리 형식이 아니면 손대지 않는다
  const key = stored.slice(1);
  return usingRemoteStorage ? `${publicBase()}/${key}` : `${LOCAL_PREFIX}${key}`;
}

/** 여러 공개 주소를 한 번에 지운다 */
export async function deleteByUrls(urls: string[]) {
  const keys = urls.map(toObjectPath).filter((key): key is string => Boolean(key));
  if (keys.length === 0) return;

  if (client && bucket) {
    // DeleteObjects 는 한 번에 1000개까지
    for (let i = 0; i < keys.length; i += 1000) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
    return;
  }

  for (const key of keys) await deleteFile(key);
}

/** 글이 지워질 때 등 파일 하나를 정리할 때 쓴다 */
export async function deleteFile(objectPath: string) {
  if (client && bucket) {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: [{ Key: objectPath }], Quiet: true },
      }),
    );
  }
  // 로컬은 지우지 않는다 — 개발 중 실수로 지워도 복구가 안 되므로 남겨 둔다
}

/** 시작할 때 로그에 한 줄 남겨 어디에 저장되는지 헷갈리지 않게 한다 */
export function storageDescription() {
  if (!usingRemoteStorage) return `로컬 디스크 ${UPLOAD_DIR}/ (S3 설정 없음)`;
  return `S3 ${bucket} (${region}) → ${publicBase()}`;
}
