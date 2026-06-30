// 인증/토큰 유틸.
//
// ⚠️ 임시: 지금은 access/refresh 토큰을 localStorage 에 저장한다.
// (백엔드 Redis 세션이 준비되면 httpOnly 쿠키 기반으로 옮기는 게 안전함)

export { BACK_API } from "./backend-url";
import { BACK_API } from "./backend-url";

const ACCESS_KEY = "zzikko_access";
const REFRESH_KEY = "zzikko_refresh";

export interface AuthUser {
  id: number;
  email: string | null;
  nickname: string;
  role: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// 카카오 인가 페이지로 이동 (인가 URL은 백엔드가 만들어준다)
export async function startKakaoLogin() {
  const res = await fetch(`${BACK_API}/api/auth/kakao/url`);
  if (!res.ok) throw new Error("카카오 로그인 URL을 가져오지 못했습니다.");
  const { url } = (await res.json()) as { url: string };
  window.location.href = url;
}

// 카카오 콜백에서 받은 code 로 로그인 → 토큰 발급
export async function loginWithKakaoCode(code: string): Promise<LoginResult> {
  const res = await fetch(`${BACK_API}/api/auth/kakao`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? "카카오 로그인에 실패했습니다.");
  }
  const data = (await res.json()) as LoginResult;
  saveTokens(data.accessToken, data.refreshToken);
  return data;
}

// access 토큰을 붙여서 백엔드 API 호출 (401 시 refresh 1회 시도)
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const access = getAccessToken();
  const headers = new Headers(init.headers);
  if (access) headers.set("Authorization", `Bearer ${access}`);

  let res = await fetch(`${BACK_API}${path}`, { ...init, headers });

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.set("Authorization", `Bearer ${refreshed}`);
      res = await fetch(`${BACK_API}${path}`, { ...init, headers });
    }
  }
  return res;
}

async function tryRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${BACK_API}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  saveTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}
