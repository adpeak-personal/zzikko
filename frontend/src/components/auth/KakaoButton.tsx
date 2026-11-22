/**
 * 카카오 로그인 버튼. 백엔드가 카카오로 보냈다가 돌려받으므로 그냥 이동하는 링크다
 * (`next/link` 가 아니라 `<a>` — 클라이언트 라우팅이 아니라 페이지를 떠나야 한다).
 *
 * 처음 온 사람은 돌아와서 /signup/kakao 에서 닉네임만 정하면 가입이 끝난다.
 */
export function KakaoButton({ next, label = '카카오로 시작하기' }: { next?: string; label?: string }) {
  const href = `/api/v1/auth/kakao${next ? `?next=${encodeURIComponent(next)}` : ''}`;
  return (
    <a
      href={href}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-kakao py-3 font-bold text-kakao-ink/85 hover:brightness-95"
    >
      {/* 카카오 말풍선 심볼 */}
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3C6.48 3 2 6.48 2 10.78c0 2.77 1.86 5.2 4.66 6.58l-.95 3.48c-.08.3.26.54.52.37l4.13-2.74c.54.07 1.08.1 1.64.1 5.52 0 10-3.48 10-7.79S17.52 3 12 3Z"
        />
      </svg>
      {label}
    </a>
  );
}

/** 카카오 버튼과 이메일 폼 사이 구분선 */
export function OrDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-gray-400">
      <span className="h-px flex-1 bg-gray-200" />
      또는 이메일로
      <span className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

/** 가입 동의 문구 — 이메일·카카오 가입 양쪽에서 같은 문장을 쓴다 */
export function AgreeCheckbox({ phone }: { phone?: boolean }) {
  return (
    <label className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-gray-600">
      <input type="checkbox" name="agree" required className="mt-0.5 accent-zz-600" />
      <span>
        만 14세 이상이며,{' '}
        <a href="/terms" target="_blank" className="font-semibold text-gray-800 underline">
          이용약관
        </a>
        과{' '}
        <a href="/privacy" target="_blank" className="font-semibold text-gray-800 underline">
          개인정보 수집·이용
        </a>
        ({phone ? '이메일, 닉네임, 지역, 휴대폰 번호 확인값' : '카카오 회원번호, 닉네임, 지역'})에 동의합니다.
      </span>
    </label>
  );
}
