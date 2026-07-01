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

/**
 * DB 에는 이 prefix 를 뗀 상대 경로만 저장하고("/blog/YYYY/…"),
 * 응답 만들 때 다시 붙여 완전한 공개 URL 로 반환한다.
 * .env 로 CDN/도메인만 바꾸면 이관 가능하도록.
 *
 * 미설정 시 storage.googleapis.com/{BUCKET_NAME} 로 자동 유도.
 */
export const PUBLIC_BASE = (
  process.env.GCS_PUBLIC_BASE || `https://storage.googleapis.com/${BUCKET_NAME}`
).replace(/\/+$/, '');

/** 공개 객체 URL (풀 URL) */
export function publicUrl(key: string): string {
  return `${PUBLIC_BASE}/${key}`;
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

/** 버퍼를 GCS 에 업로드하고 공개 URL(풀) 반환 */
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

// ─── URL <-> 상대경로 변환 헬퍼 ─────────────────────────────
// 저장/응답 사이의 유일한 규칙:
//   DB 에는 우리 버킷 이미지 → "/blog/…"  (leading '/' 포함, PUBLIC_BASE 는 뗌)
//   DB 에는 외부(http/https) 이미지 → 그대로 (예: naver.net 이미지)
//   응답 시  http* 로 시작 → 그대로,  '/' 로 시작 → PUBLIC_BASE 붙여서 풀 URL 로.

/** 이 버킷 URL 이면 "/…" 로 자르고, 그 외(외부 URL / 이미 상대경로)는 그대로 반환. */
export function toRelative(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  const basePrefix = PUBLIC_BASE + '/';
  if (url.startsWith(basePrefix)) return '/' + url.slice(basePrefix.length);
  return url;
}

/** '/…' 이면 PUBLIC_BASE 붙여 풀 URL 로, http* 시작이면 그대로, 그 외 그대로. */
export function toDisplayUrl<T extends string | null | undefined>(pathOrUrl: T): T {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  if (pathOrUrl.startsWith('/')) return (PUBLIC_BASE + pathOrUrl) as T;
  return pathOrUrl;
}

/** HTML/JSON 문자열 안의 우리 버킷 풀 URL 을 모두 '/…' 로 치환. */
export function stripBaseInText(text: string | null | undefined): string {
  if (!text) return '';
  const basePrefix = PUBLIC_BASE + '/';
  // split/join 은 정규식 이스케이프 필요 없고 훨씬 안전
  return text.split(basePrefix).join('/');
}

// <img src="/…"> 형태에서 상대경로 부분만 잡는 정규식.
// 응답 확장은 img/anchor 태그 컨텍스트에서만 하도록 좁혀서 오탐 방지.
const IMG_REL_RE = /(<img\b[^>]*\bsrc=["'])(\/[^"']+)(["'])/gi;
const ANCHOR_REL_RE = /(<a\b[^>]*\b(?:href|data-image)=["'])(\/[^"']+)(["'])/gi;

/** HTML 안의 <img src="/…"> / <a href="/…"> 를 풀 URL 로 재구성. */
export function expandBaseInHtml(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(IMG_REL_RE, (_m, a, p, c) => `${a}${PUBLIC_BASE}${p}${c}`)
    .replace(ANCHOR_REL_RE, (_m, a, p, c) => `${a}${PUBLIC_BASE}${p}${c}`);
}

/**
 * extra_data 등 JSON 안의 상대 이미지 경로를 풀 URL 로 재구성.
 * - 대상: 값이 문자열이고 '/' 로 시작하며 이미지 확장자인 것.
 * - '/' 로 시작하되 이미지 확장자가 아니면 앱 내부 링크일 가능성이 크므로 그대로 둔다.
 */
const IMG_EXT_RE = /\.(webp|jpe?g|png|gif|avif|svg)(\?.*)?$/i;
export function expandExtraData(raw: unknown): unknown {
  if (raw == null) return raw;
  // mysql2 는 JSON 컬럼을 자동 파싱해서 객체/배열로 준다. 문자열로 오는 케이스도 방어.
  let val = raw;
  if (typeof val === 'string') {
    try {
      val = JSON.parse(val);
    } catch {
      return val;
    }
  }
  return walkExpand(val);
}
function walkExpand(v: unknown): unknown {
  if (typeof v === 'string') {
    if (v.startsWith('/') && IMG_EXT_RE.test(v)) return PUBLIC_BASE + v;
    return v;
  }
  if (Array.isArray(v)) return v.map(walkExpand);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, vv] of Object.entries(v)) out[k] = walkExpand(vv);
    return out;
  }
  return v;
}

/**
 * 임의의 이미지 소스를 다운로드해서 Buffer 로 반환.
 * - 상대경로("/blog/…") 또는 우리 버킷 풀 URL → 버킷에서 다운로드
 * - 외부 http(s) URL → HTTP 로 다운로드 (UA/Referer 세팅)
 * - 실패 시 null (원인은 warn 로그로 남김)
 */
async function downloadImageForThumb(src: string): Promise<Buffer | null> {
  try {
    if (src.startsWith('/')) {
      const srcKey = decodeURIComponent(src.replace(/^\/+/, ''));
      const [buf] = await bucket.file(srcKey).download();
      return buf;
    }
    if (src.startsWith(PUBLIC_BASE + '/')) {
      const srcKey = decodeURIComponent(src.slice(PUBLIC_BASE.length + 1));
      const [buf] = await bucket.file(srcKey).download();
      return buf;
    }
    if (/^https?:\/\//i.test(src)) {
      let referer: string | undefined;
      try {
        const u = new URL(src);
        referer = `${u.protocol}//${u.hostname}/`;
      } catch {
        referer = undefined;
      }
      const resp = await fetch(src, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          ...(referer ? { Referer: referer } : {}),
        },
      });
      if (!resp.ok) {
        console.warn(`[thumb] fetch ${resp.status} ${src}`);
        return null;
      }
      return Buffer.from(await resp.arrayBuffer());
    }
    return null;
  } catch (err) {
    console.warn(`[thumb] download failed ${src}: ${(err as Error).message}`);
    return null;
  }
}

async function processAndUploadThumb(
  buf: Buffer,
  destPrefix: string,
): Promise<string | null> {
  try {
    const thumb = await sharp(buf)
      .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();
    const key = `${destPrefix}/${datePath()}/thumb_${randomUUID()}.webp`;
    await uploadBuffer(key, thumb, 'image/webp');
    return '/' + key;
  } catch (err) {
    console.warn(`[thumb] process/upload failed: ${(err as Error).message}`);
    return null;
  }
}

/**
 * 임의의 URL/경로에서 썸네일(webp) 생성 → GCS 업로드 → 상대경로("/…") 반환.
 * 실패하면 null. **절대 외부 URL 을 그대로 반환하지 않는다** — DB 에 외부 URL 이 새어 들어가는 일이 없도록.
 */
export async function makeThumbFromUrl(
  src: string | null | undefined,
  destPrefix: string = 'posts',
): Promise<string | null> {
  if (!BUCKET_NAME || !src) return null;
  const buf = await downloadImageForThumb(src);
  if (!buf) return null;
  return processAndUploadThumb(buf, destPrefix);
}

/**
 * 본문 HTML 의 첫 번째 이미지로 썸네일(webp)을 만들어 GCS 에 올리고 상대경로("/…") 를 반환한다.
 * - 글 작성 시 호출 → 목록 썸네일로 사용 (thumbnail_url 컬럼에 저장).
 * - 본문 첫 이미지가:
 *     1) 상대 경로 ("/blog/…")  → 우리 버킷에서 다운로드
 *     2) 우리 버킷 풀 URL       → 우리 버킷에서 다운로드
 *     3) 외부 http(s) URL        → HTTP 로 다운로드 (naver 등)
 * - 셋 다 실패하면 null.
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
  return makeThumbFromUrl(m[1], destPrefix);
}

/**
 * 주어진 문자열들(본문/썸네일/extra_data 등) 안에서 이 버킷의 객체 URL/상대경로를 모두 찾아
 * GCS 에서 삭제한다. (글 삭제 시 호출 → 고아 이미지 0)
 * - 신규 데이터(상대 경로)와 구 데이터(풀 URL) 을 모두 매칭
 * - 존재하지 않거나 실패한 파일은 무시한다(idempotent).
 */
export async function deleteStoredImages(
  ...texts: (string | null | undefined)[]
): Promise<void> {
  if (!BUCKET_NAME) return;

  const basePrefix = PUBLIC_BASE + '/';
  const fullRe = new RegExp(`${escapeRegExp(basePrefix)}([^\\s"'<>)]+)`, 'g');
  // 상대 경로는 컨텍스트 없이 매칭하면 앱 링크(/posts/…) 를 잘못 잡을 수 있어
  // 이미지/링크 속성 안의, 이미지 확장자로 끝나는 것만 잡는다.
  const relRe = /(?:src|href|data-image)=["'](\/[^"']+\.(?:webp|jpe?g|png|gif|avif|svg)(?:\?[^"']*)?)["']/gi;

  const keys = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const mm of text.matchAll(fullRe)) {
      keys.add(decodeURIComponent(mm[1]));
    }
    for (const mm of text.matchAll(relRe)) {
      // '/blog/…' → 'blog/…'
      keys.add(decodeURIComponent(mm[1].replace(/^\/+/, '').replace(/\?.*$/, '')));
    }
  }
  if (keys.size === 0) return;

  await Promise.all(
    [...keys].map((key) =>
      bucket.file(key).delete({ ignoreNotFound: true }).catch(() => {}),
    ),
  );
}

/**
 * 본문(또는 임의 문자열) 안의 tmp/ 이미지들을 {destPrefix}/ 로 이동하고,
 * 문자열 안의 우리 버킷 URL 은 전부 상대경로("/…") 로 바꾼 결과를 반환한다.
 * - 글 저장 시 호출 → 영구 폴더에는 실제로 글에 쓰인 이미지만 남는다(고아 0).
 * - 저장 안 된(취소된) tmp/ 이미지는 그대로 남아 Lifecycle 규칙으로 자동 삭제.
 * - 결과 문자열은 항상 상대 경로 형태 (DB 에 그대로 넣음).
 *
 * 처리 가능한 입력:
 *   - 우리 버킷 풀 URL:  https://storage.googleapis.com/zzikko/tmp/…
 *   - 상대 경로:         /tmp/…
 *   - 이미 이동된 상태(/blog/… 등) 도 통과 (그대로 상대경로 유지)
 *
 * @param destPrefix 저장될 GCS 경로 prefix. 게시판별 폴더 분리에 사용 (e.g. 'blog', 'posts', 'community')
 */
export async function finalizeTmpUrls(
  html: string,
  destPrefix: string = 'posts',
): Promise<string> {
  if (!html || !BUCKET_NAME) return html;

  const fullTmpPrefix = `${PUBLIC_BASE}/tmp/`;
  const fullRe = new RegExp(`${escapeRegExp(fullTmpPrefix)}([^\\s"'<>)]+)`, 'g');
  // 상대 tmp — 이미지 확장자에 한정
  const relRe = /(?:src|href|data-image)=["'](\/tmp\/([^"']+\.(?:webp|jpe?g|png|gif|avif|svg)(?:\?[^"']*)?))["']/gi;

  const rests = new Set<string>(); // rest = "YYYY/MM/DD/uuid.ext"
  for (const mm of html.matchAll(fullRe)) rests.add(mm[1]);
  for (const mm of html.matchAll(relRe)) rests.add(mm[2].replace(/\?.*$/, ''));

  let result = html;
  for (const rest of rests) {
    const srcKey = `tmp/${rest}`;
    const destKey = `${destPrefix}/${rest}`;
    try {
      await bucket.file(srcKey).move(destKey);
    } catch {
      // 이미 이동됐거나 존재하지 않으면 무시 (idempotent)
    }
    // 풀 URL 형태 치환 → 상대경로로
    result = result.split(fullTmpPrefix + rest).join(`/${destKey}`);
    // 상대 형태 치환
    result = result.split(`/tmp/${rest}`).join(`/${destKey}`);
  }

  // 그 외 남은 우리 버킷 풀 URL 도 상대경로로 강제
  return stripBaseInText(result);
}
