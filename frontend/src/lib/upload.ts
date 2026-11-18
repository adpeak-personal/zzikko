import type { UploadedImage } from '@/components/editor';

/**
 * 이미지 업로드 — 백엔드가 받아서 S3(설정돼 있으면) 또는 서버 디스크에 저장한다.
 * 에디터와 사진 업로더는 저장 위치를 모르고 이 함수만 부른다.
 *
 * 응답의 url 은 늘 바로 띄울 수 있는 전체 주소다. DB 에 도메인 없이 저장하는 건
 * 백엔드가 알아서 하므로 프론트는 신경 쓰지 않는다.
 */
const MAX_BYTES = 10 * 1024 * 1024;

export async function uploadImage(file: File): Promise<UploadedImage> {
  if (file.size > MAX_BYTES) throw new Error('이미지는 10MB 까지 올릴 수 있어요.');

  const form = new FormData();
  form.append('file', file);

  // FormData 는 boundary 를 브라우저가 붙이므로 Content-Type 을 직접 넣지 않는다
  const res = await fetch('/api/v1/uploads/image', { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? (res.status === 401 ? '로그인이 필요합니다.' : '이미지를 올리지 못했어요.'));
  }
  return res.json();
}
