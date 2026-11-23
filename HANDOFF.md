# 이어서 할 일 (2026-11-23)

다른 컴퓨터에서 이어받을 때 이 파일부터 읽는다. 규칙은 `CLAUDE.md`, 프론트는
`frontend/AGENTS.md` 를 따른다. **이 파일은 임시다** — 아래 항목이 다 끝나면 지운다.

## 지금 상태

`main` 의 마지막 커밋들:

```
b28008f  이용약관 · 개인정보처리방침 초안
0384e64  가입 개편 — 카카오 로그인, 이메일 가입은 휴대폰 인증
b66611c  앱 아이콘 — 흰 바탕에 로고 (카카오 앱 등록용)
1efb927  게시판 관리 — 대분류 추가, 홈의 중고장터는 게시판이 있을 때만
a93f62f  게시판 관리 — 대분류·게시판 순서 바꾸기
```

`main` 에 푸시하면 운영(141.164.60.58)으로 자동 배포된다.
`1efb927` 까지는 운영에 올라가 확인했다. 그 뒤 세 개는 이 메모와 같이 푸시한다.
운영의 '🛒 장터 & 생활' 대분류(글 0개)는 지웠다.

## 0. 가입 개편 배포 마무리 — 다음에 바로 할 것

1. 배포가 끝났는지 본다. 서버 `/opt/zzikko/.tag` 가 이 메모 커밋(`sha-...`)이면 끝난 것.
2. **운영 마이그레이션**(배포가 끝난 뒤에 — 먼저 돌리면 옛 스크립트가 돈다):
   ```
   ssh root@141.164.60.58 "cd /opt/zzikko && docker compose exec -T back node scripts/migrate.mjs --yes"
   ```
   `users.kakao_id + phone_hash` · `phone_verifications` 두 단계가 새로 적용돼야 한다.
   한 번 더 돌려 둘 다 `이미 적용됨` 인지 확인.
3. `/`, `/login`, `/signup`, `/terms`, `/privacy` 가 뜨는지 본다.

⚠️ **키를 넣기 전까지 운영에서 새 회원가입이 막힌다.** 문자 키가 없으면 이메일 가입이 숨고
(`/auth/options` 의 `phone: false`), 카카오 키가 없으면 카카오 버튼도 숨는다. 기존 회원 로그인은 된다.

## 0-1. 카카오 콘솔 (사용자가 할 일)

developers.kakao.com → 내 애플리케이션 → 앱 추가(아이콘은 `assets/app-icon-512.png`).

- 앱 키 → **REST API 키** → `KAKAO_REST_API_KEY`
- 플랫폼 → Web 사이트 도메인: `https://zzikko.co.kr`, `http://localhost:4050`
- 카카오 로그인 → 활성화 ON
- Redirect URI: `https://zzikko.co.kr/api/v1/auth/kakao/callback`,
  `http://localhost:4050/api/v1/auth/kakao/callback` (다르면 KOE006)
- 보안 → **Client Secret** 발급, 활성화 '사용함' → `KAKAO_CLIENT_SECRET`
- 동의항목 → **닉네임** 필수 동의 (이메일은 받지 않는다)

키는 채팅에 붙이지 말고 로컬은 `backend/.env.local`, 운영은 `/opt/zzikko/.env.back` 에 넣는다.
운영은 넣은 뒤 **`bash deploy.sh`**(태그 없이 — 마지막 배포를 다시 올림). `restart` 는 env 를 다시 안 읽는다.

## 0-2. 문자 인증 (솔라피) — 나중

`SOLAPI_API_KEY` · `SOLAPI_API_SECRET` · `SMS_FROM`(솔라피에 등록한 발신번호).
셋이 다 있어야 이메일 가입이 열린다. 개발 환경에서는 키 없이도 서버 로그에 인증번호가 찍힌다.

## 0-3. 약관 페이지 · 동의 기록

동의 기록을 남기지 않는다 — `agree` 는 받기만 하고 버린다. "언제 어느 버전에 동의했는지"
증명할 자료가 가입 시각뿐이다. 회원이 늘기 전에 동의 시각·약관 버전을 저장해 둘 것.


`/terms`, `/privacy` 는 **초안**이다. `frontend/src/components/legal/LegalDoc.tsx` 의
`OPERATOR.email` 이 비어 있어 연락처가 '준비 중' 으로 나온다. 정식 서비스 전에 법률 검토.
가입 항목·외부 업체를 바꾸면 개인정보처리방침도 같이 고친다.

## 1~2. 운영 마이그레이션 · 환경변수 정리 — 끝났다 ✅

2026-11-22 확인. `ANTHROPIC_WRITE_MODEL` 줄은 `.env.back` 에서 주석 처리돼 있다.
`boards.admin_only` 마이그레이션도 운영에 적용했다.

## 3. 옛 시세 글 세 개 삭제

주소에서 날짜를 뺀 뒤(`cfe111a`) 남은 날짜 붙은 글들이다. /admin/sise 에서 지운다.

- `seoul-2026-11-11`
- `seoul-2026-11-18`
- `daegu-2026-11-18`

## 4. 사이트 기본 og 이미지 — 끝났다 ✅

`frontend/public/og.png`(1200×630, 로고 + 슬로건). 레이아웃과 `articleOg` 둘 다
`seo.ts` 의 `DEFAULT_OG_IMAGE` 를 쓴다 — 사진 없는 글도 이걸로 채운다.

## 5. RSS — 미룸

`/sitemap.xml` 과 구조화 데이터가 들어간 지금은 효용이 낮다고 보고 미뤘다.
나중에 할 때는 기사 게시판만 내보내면 된다.

## 알아 둘 것 (고치지 않은 것)

- **집 PC 의 로컬 MySQL 은 `zzikko_cafe` 접속이 거부됐다**(권한). 가입 개편은 DB 없이
  단위 검사와 HTTP 검사로만 확인했다 — 사무실에서 DB 가 되면 가입·카카오 흐름을 끝까지 돌려 볼 것.
- `next build` 를 돌리면 `frontend/next-env.d.ts` 가 바뀐다. 커밋하지 말고 되돌린다.
- 프로젝트에 prettier 설정이 없다. `npx prettier` 를 돌리면 파일 전체가 기본 설정으로 바뀐다.

- **`/compare/[slug]` 가 정적으로 안 구워진다.** 레이아웃의 `getBoardGroups` 가
  `apiGet`(쿠키)을 쓰기 때문이다. `next build` 에 `Dynamic server usage` 경고가
  23개 나오는데, 이번 작업 전에도 23개였다 — **우리가 만든 게 아니다.**
  고치려면 레이아웃이 `apiGetPublic` 을 쓰게 바꿔야 한다.
- 뉴스 자동 수집이 `setInterval` 이라 **컨테이너가 뜬 시각 기준**으로 돈다.
  정해진 시각(예: 매일 9시)에 돌게 바꾸는 건 아직 안 했다.

## 함정 (다시 밟지 말 것)

- `cookies()` 를 부르면 그 라우트는 동적이 된다 — `revalidate` 가 조용히 무시된다.
  `next build` 출력에서 `ƒ` 면 동적, `○ ... 1h` 면 정적이다.
- `fetch(url, { revalidate: n, cache: 'no-store' })` → Next 는 **둘 다** 무시한다.
- 페이지에 `openGraph` 를 적으면 루트 레이아웃 것을 **통째로** 덮는다. 그래서
  `frontend/src/lib/seo.ts` 의 `articleOg()` 를 쓴다.
- 날짜는 `iso()`(`' '` → `'T'`)로만 만든다. `toISOString()` 은 KST/UTC 차이로 9시간 민다.
- 지역 키워드는 **행을 지우지 않고 숨긴다**(`hidden = 1`). 조회할 지역 목록이
  고정이라 진짜 지우면 다음 '검색량 가져오기' 에 그대로 돌아온다. 수집함 '삭제'도 같다.
- 퍼온 기사의 **원문 사진은 가져오지 않는다**. 사진은 제조사 뉴스룸에서.
