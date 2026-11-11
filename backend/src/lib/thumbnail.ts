/**
 * 목록 썸네일 — 글을 등록·수정할 때 **첫 이미지 하나만** 만든다.
 *
 * 썸네일이 쓰이는 곳은 게시판 목록과 갤러리뿐이고, 거기 뜨는 건 글의 첫 이미지다.
 * 올리는 족족 만들면 사진 여러 장짜리 글에서 나머지는 아무도 안 보는 파일이 된다.
 */
import { makeThumb } from './images.js';
import { readFileAt, saveBuffer, toObjectPath } from './storage.js';
import { setThumbUrl } from '../repositories/uploads.js';

/** 본문용 경로 → 썸네일 경로 (`2026-10-12/uuid.webp` → `2026-10-12/uuid_thumb.webp`) */
function thumbPathFor(objectPath: string): string | null {
  if (!objectPath.endsWith('.webp')) return null; // 변환하지 않은 파일(애니메이션 GIF)
  if (objectPath.includes('_thumb.')) return objectPath;
  return objectPath.replace(/\.webp$/, '_thumb.webp');
}

/**
 * 본문 첫 이미지의 썸네일을 준비하고, **글에 저장할 주소를 돌려준다.**
 *
 * 돌려준 값을 그대로 `posts.thumb_url` 에 넣는다 — 저장된 값이 곧 "실제로 있는 파일"
 * 이 되도록. 읽을 때 경로를 규칙으로 바꾸면, 생성이 실패했을 때 없는 파일을 가리켜
 * 목록에 깨진 이미지가 뜬다.
 *
 * 이미 있으면 다시 만들지 않고, 실패하면 원본 주소를 그대로 돌려준다.
 * 썸네일 하나 때문에 글 등록을 막지 않는다.
 */
export async function ensureThumbnail(url: string): Promise<string> {
  const objectPath = toObjectPath(url);
  if (!objectPath) return url; // 외부 이미지

  const thumbPath = thumbPathFor(objectPath);
  if (!thumbPath || thumbPath === objectPath) return url;

  try {
    if (await readFileAt(thumbPath)) {
      return url.replace(objectPath, thumbPath);
    }

    const source = await readFileAt(objectPath);
    if (!source) return url;

    const thumb = await makeThumb(source);
    const saved = await saveBuffer(thumbPath, thumb.body, 'image/webp');

    // 청소할 때 썸네일도 같이 지워져야 하므로 기록해 둔다
    await setThumbUrl(url, saved.url);
    return saved.url;
  } catch {
    return url;
  }
}
