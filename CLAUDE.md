# zzikko (찍고)

네이버 카페형 휴대폰 커뮤니티. 구성과 실행법은 [README.md](README.md) 참고.

프론트(Next.js) · 백엔드(Fastify) · MySQL 로 돌아간다. 화면에 보이는 데이터는 전부 DB 에서 온다
(더 이상 목업 파일이 없다).

## 작업할 때 지킬 것

### 데이터

- **프론트에서 백엔드를 부를 땐 `frontend/src/lib/api.ts` 를 쓴다.** 컴포넌트에서 `fetch` 를 직접 쓰지 말 것.
  - 서버 컴포넌트 → `apiGet` / `apiGetOrNull` (절대주소 + 로그인 쿠키 전달)
  - 브라우저 → `apiFetch` (상대경로. `next.config.ts` 의 rewrite 가 백엔드로 넘긴다)
- 게시글·게시판·매장처럼 자주 쓰는 조회는 `frontend/src/lib/data.ts` 에 함수로 모아 둔다.
- **API 타입은 `frontend/src/lib/types.ts` 와 `backend/src/types.ts` 가 같은 모양을 유지해야 한다.**
  한쪽만 고치지 말 것.
- DB 는 snake_case, API 는 camelCase 다. 변환은 `backend/src/repositories/*.ts` 안에서만 한다.

### 게시판

- **게시판(대분류·소분류)은 DB 의 `board_groups` / `boards` 테이블이 정본이다.** 어드민 `/admin/boards` 에서
  고치거나, 초기 데이터라면 `backend/scripts/seed.mjs` 를 고친다.
  사이드바·모바일 메뉴·자주 쓰는 메뉴가 모두 여기서 파생된다.
- `boards.type` 이 목록 형태를 정한다.
  - `list` / `deal` / `gallery` — 회원이 쓴 글(`posts`)
  - `news` / `spec` — 운영진이 어드민에서 관리하는 콘텐츠(`news_articles`, `phone_specs`). 글쓰기 버튼·말머리 칩·
    페이지 번호·검색을 쓰지 않는다.
- `boards.categories` 가 말머리다. 성지 시세표의 말머리는 지역이다.

### 스펙 비교

- 비교 항목과 규칙은 `frontend/src/components/specs/spec-rows.ts` 한 곳에 있다. 항목을 추가할 때 비교 규칙
  (`higher` / `lower` / `tier` / `neutral` / `none`)도 같이 정한다.
- 화면에 보여줄 문장(`display`, `battery` …)과 비교용 숫자(`displayInch`, `batteryMah` …)는 **따로 저장한다.**
  문장에서 숫자를 긁어내면 표기가 조금만 달라져도 깨진다.
- **칩셋은 등급(`플래그십`~`보급형`)으로만 우열을 매긴다.** 벤치마크 점수를 넣지 말 것 — 출처 시비가 붙는다.

### 화면

- **색·글자 크기는 `frontend/src/app/globals.css` 의 `@theme` 토큰을 쓴다.** 컴포넌트에 `#fa6038` 같은 값을
  직접 적지 말 것 (`zz-500`, `shop-500` 등으로).
- `Header` 에 `backdrop-blur` 나 `transform` 을 넣지 말 것 — 안쪽 모바일 드로어(`fixed`)가 헤더 영역에 갇힌다.
- 그리드 칼럼은 `1fr` 대신 `minmax(0, 1fr)` — 모바일에서 가로 스크롤이 생긴다.
- **`components/editor` 와 `components/photo-uploader` 는 독립 모듈이다.** 프로젝트 유틸(`@/lib/...`)을
  끌어다 쓰지 말고, 새 의존이 필요하면 prop 으로 주입한다 — 다른 프로젝트로 폴더째 옮길 수 있게 유지한다.
  두 모듈은 abyssblue 와 같은 코드라, 고칠 일이 생기면 양쪽을 같이 보는 편이 좋다.
- 화면 문구는 한국어. 게시글·매장·시세는 전부 예시 데이터이므로, 새로 추가할 때도 실제 매장이나 실제 가격처럼
  보이지 않게 쓴다.

### 업로드

- 프론트는 `src/lib/upload.ts` 만 부른다. 백엔드는 `src/lib/storage.ts` 가 저장 위치를 정한다.
- **올린 이미지는 webp 로 변환해 저장한다**(`src/lib/images.ts`). 용량도 줄지만, 변환 과정에서
  EXIF(촬영 위치 포함)가 사라지는 게 더 중요하다 — 휴대폰 사진을 그대로 올리는 커뮤니티다.
- **썸네일은 글을 등록할 때 첫 이미지에만 만든다**(`src/lib/thumbnail.ts`). 목록에 뜨는 건
  글의 첫 이미지뿐이라, 올리는 족족 만들면 나머지는 아무도 안 보는 파일이 된다.
- `uploads.post_id` 가 NULL 이면 어느 글에도 안 쓰인 파일이다. 서버가 주기적으로 지운다
  (`src/lib/maintenance.ts`, 기본 6시간마다 / 24시간 유예). 끄려면 `MAINTENANCE_ENABLED=false`.
- `GCS_BUCKET` · `GCS_PROJECT` · `GCS_KEY_FILE` 이 **셋 다** 있으면 GCS, 하나라도 없으면 로컬 디스크
  (`UPLOAD_DIR`)에 저장한다. 라우트는 어느 쪽인지 모른다.
- 저장 파일 이름은 서버가 만든다(`날짜/UUID.확장자`). 올라온 파일 이름을 그대로 쓰지 말 것 — `../` 가 섞인다.
- **서비스 계정 키(`gcs-key.json`)를 커밋하지 말 것.** `.gitignore` 에 이미 들어 있다.

## 환경변수

- `.env` = 비밀이 아닌 공용 설정(포트·CORS·업로드 폴더). **git 에 올라간다.**
- `.env.local` = 비밀값(`DATABASE_URL`, `JWT_SECRET`, `GCS_*`). git 에 안 올라간다. 나중에 읽히므로 이긴다.
- **`.env` 에 비밀값을 적지 말 것.** 새 항목을 추가하면 `.env.example` 에도 설명을 남긴다.
- 읽는 순서는 `backend/src/env.ts` 와 `backend/scripts/seed.mjs` 두 곳에 있다 — 한쪽만 고치지 말 것.
- `JWT_SECRET` 은 기본값이 없다. 없으면 서버가 뜨지 않는다(아무나 아는 키로 서명되는 게 더 위험해서).

## 포트 · DB

- 프론트 `4050`, 백엔드 `4080`, MySQL `3306`
- **DB 이름은 `zzikko` 가 아니라 `zzikko_cafe`.** 같은 PC 의 `zzikko` DB 는 네이버 블로그 자동화
  프로젝트(`blog_jobs`, `nwork`, `user_aliases` …)가 쓰고 있다. `schema.sql` 은 `DROP TABLE` 로
  시작하므로 DB 이름을 바꾸면 그쪽 데이터를 지운다.
- 같은 PC 에서 다른 프로젝트가 `4000~4002`·`4010`(bunyang CRM1) · `4100`·`4110`(CRM2) · `5000`·`5030`(abyssblue)
  을 쓰므로 겹치지 않게 유지한다.

## 인증

- 비밀번호는 `scrypt` 해시(`salt:hash`), 세션은 httpOnly 쿠키(`zzikko_session`)에 담긴 JWT.
- 라우트 보호는 `backend/src/lib/auth.ts` 의 `requireAuth` / `requireAdmin` preHandler 로 한다.
- 어드민 화면은 서버 컴포넌트에서 `me.role !== '운영진'` 이면 redirect 한다. **화면 가림만으로 끝내지 말고
  백엔드 라우트에도 `requireAdmin` 을 붙일 것.**

### 글 지우기

- **글·댓글은 실제로 지우지 않는다.** `deleted_at` 에 시각을 적는다 — 댓글·좋아요가 글을
  `CASCADE` 로 참조하고 있어서 진짜 지우면 같이 날아가고 되돌릴 수 없다.
- 모든 조회는 `deleted_at IS NULL` 을 걸러야 한다. 운영진은 `POST /posts/:id/restore` 로 되살린다.

## 스키마를 바꿀 때

- **`schema.sql` 은 `DROP TABLE` 로 시작한다.** 데이터가 든 DB 에 쓰면 안 된다.
- 바뀐 내용은 `backend/scripts/migrate.mjs` 에 한 칸 더하고 `npm run db:migrate -- --yes` 로 적용한다.
  "없을 때만" 적용되므로 여러 번 돌려도 안전하다.
- **`schema.sql` 도 같이 고칠 것** — 처음 설치하는 사람은 그 파일만 본다.

## 아직 없는 것

판매자 인증, 알림, 비밀번호 찾기, 신고, 회원 관리 어드민.
