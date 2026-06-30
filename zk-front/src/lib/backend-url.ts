// 환경별 백엔드 URL 결정 헬퍼.
//
// - 브라우저(client-side): NEXT_PUBLIC_BACK_API (빌드 시점에 클라이언트 번들에 박힘)
//   미설정 시 dev 폴백 "http://localhost:3041"
//
// - SSR/RSC(서버 사이드, 컨테이너 내부 fetch): INTERNAL_BACK_API (runtime env)
//   도커에서 backend 컨테이너로 직접 도달 (예: "http://backend:4000")
//   미설정 시 NEXT_PUBLIC_BACK_API → dev 폴백 순으로
//
// 클라이언트는 INTERNAL 을 절대 알면 안 되고, 서버는 INTERNAL 을 우선 사용.

const DEV_FALLBACK = "http://localhost:3041";

export function getBackendUrl(): string {
  if (typeof window === "undefined") {
    return (
      process.env.INTERNAL_BACK_API ??
      process.env.NEXT_PUBLIC_BACK_API ??
      DEV_FALLBACK
    );
  }
  return process.env.NEXT_PUBLIC_BACK_API ?? DEV_FALLBACK;
}

/** 자주 참조하는 곳 위해 모듈 로드 시점에 한 번 계산. */
export const BACK_API = getBackendUrl();
