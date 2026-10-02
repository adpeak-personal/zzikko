export function formatRelative(iso: string) {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}시간 전`;
  return formatDate(iso);
}

export function formatDate(iso: string) {
  const date = new Date(iso);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() === new Date().getFullYear() ? `${mm}.${dd}` : `${date.getFullYear()}.${mm}.${dd}`;
}

export function formatNumber(n: number) {
  return n.toLocaleString('ko-KR');
}

/** 150000 → "15만원", 0 → "0원" */
export function formatPrice(won: number) {
  if (won === 0) return '0원';
  if (won % 10000 === 0) return `${won / 10000}만원`;
  return `${won.toLocaleString('ko-KR')}원`;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function isNew(iso: string) {
  return Date.now() - new Date(iso).getTime() < 24 * 60 * 60 * 1000;
}

/** 이미지가 있는 글의 썸네일 색. 지정된 값이 없으면 글 번호로 항상 같은 색을 고른다. */
const THUMB_TONES = ['violet', 'rose', 'teal', 'amber', 'indigo', 'slate', 'zz'];

export function thumbTone(post: { id: number; thumb?: string; hasImage?: boolean }) {
  if (post.thumb) return post.thumb;
  if (!post.hasImage) return undefined;
  return THUMB_TONES[post.id % THUMB_TONES.length];
}
