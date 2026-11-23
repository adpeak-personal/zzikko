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

/**
 * 로그인·가입을 마치고 돌아갈 곳. **우리 사이트 안의 경로만** 받는다.
 *
 * ⚠️ `startsWith('/')` 만 보면 안 된다 — `//evil.com` 도 `/` 로 시작하는데
 * 브라우저는 그걸 "같은 프로토콜의 다른 사이트" 로 읽는다. 실측으로
 * `/login?next=//example.com` 으로 로그인하면 example.com 으로 나갔다.
 * **로그인이 성공한 뒤**라 사람은 눈치채지 못하고, 그 페이지가 "세션이 만료됐습니다" 를
 * 띄우면 비밀번호를 그대로 넘겨준다.
 *
 * 백엔드 `routes/auth.ts` 의 `safeNext` 와 같은 규칙이다 — 한쪽만 고치지 말 것.
 */
export function safeNext(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return '/';
  // `//evil.com` 과 `/\evil.com` 은 둘 다 사이트 밖으로 나가는 주소다
  if (value.startsWith('//') || value.includes('\\')) return '/';
  // 제어문자가 섞인 주소는 받지 않는다
  if ([...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return '/';
  return value;
}
