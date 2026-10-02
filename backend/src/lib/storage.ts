import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { Storage } from '@google-cloud/storage';

/**
 * 업로드 파일 저장소.
 *
 * GCS 설정이 있으면 Google Cloud Storage 로, 없으면 로컬 디스크로 저장한다.
 * 키가 준비되기 전에도 개발이 멈추지 않게 하려는 것이고, 어느 쪽이든
 * 돌려주는 값은 `url` 하나뿐이라 호출부(라우트)는 저장 위치를 모른다.
 *
 * 필요한 환경변수 (셋 다 있으면 GCS 사용):
 *   GCS_BUCKET      버킷 이름
 *   GCS_PROJECT     프로젝트 ID
 *   GCS_KEY_FILE    서비스 계정 키(JSON) 경로
 *   GCS_PUBLIC_HOST (선택) CDN 이나 커스텀 도메인. 없으면 storage.googleapis.com
 */

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? 'uploads';

const bucketName = process.env.GCS_BUCKET;
const projectId = process.env.GCS_PROJECT;
const keyFilename = process.env.GCS_KEY_FILE;

export const usingGcs = Boolean(bucketName && projectId && keyFilename);

const storage = usingGcs ? new Storage({ projectId, keyFilename }) : null;

export interface SavedFile {
  /** 본문·썸네일에 넣을 주소 */
  url: string;
  /** 저장 경로 (버킷 안 경로 또는 로컬 상대경로) */
  path: string;
}

/**
 * 파일 하나를 저장한다.
 *
 * 저장 이름은 호출부가 만들어 넘긴다(`objectPath`) — 업로드된 파일 이름을 그대로 쓰면
 * `../` 같은 경로가 섞여 들어올 수 있어서다.
 */
export async function saveFile(objectPath: string, stream: Readable, contentType: string): Promise<SavedFile> {
  if (storage && bucketName) {
    const file = storage.bucket(bucketName).file(objectPath);
    await pipeline(
      stream,
      file.createWriteStream({
        resumable: false, // 10MB 이하라 한 번에 올린다
        contentType,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      }),
    );

    const host = process.env.GCS_PUBLIC_HOST ?? `https://storage.googleapis.com/${bucketName}`;
    return { url: `${host}/${objectPath}`, path: objectPath };
  }

  // 로컬 디스크 — 백엔드가 /uploads/ 로 그대로 서빙한다
  const target = join(UPLOAD_DIR, objectPath);
  await mkdir(join(target, '..'), { recursive: true });
  await pipeline(stream, createWriteStream(target));
  return { url: `/uploads/${objectPath}`, path: target };
}

/** 글이 지워질 때 등 파일을 정리할 때 쓴다 */
export async function deleteFile(objectPath: string) {
  if (storage && bucketName) {
    await storage
      .bucket(bucketName)
      .file(objectPath)
      .delete({ ignoreNotFound: true });
  }
  // 로컬은 지우지 않는다 — 개발 중 실수로 지워도 복구가 안 되므로 남겨 둔다
}

/** 시작할 때 로그에 한 줄 남겨 어디에 저장되는지 헷갈리지 않게 한다 */
export function storageDescription() {
  return usingGcs ? `GCS ${bucketName}` : `로컬 디스크 ${UPLOAD_DIR}/ (GCS 설정 없음)`;
}
