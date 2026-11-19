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
- 사양은 `lib/specs/extract.ts` 로 넣는다. **제조사 자료에 있는 것만 옮기고 없으면 비워 둔다** —
  AI 가 아는 지식으로 채우면 그럴듯한 가짜 숫자가 들어가고 아무도 못 잡는다.
  단위 환산(mm→인치, MP→만 화소, "25년 1월"→2025-01)은 계산이므로 허용한다.
  제조사 사양 페이지는 JS 로 그려져 서버가 긁으면 안 나오므로, 붙여넣은 글이나 캡처를 받는다
  (`POST /admin/specs/extract` — 본문이 JSON 이면 글, 멀티파트면 이미지).
- 어드민 '사양 붙여넣기'는 **칸만 채우고 저장하지 않는다.** 사람이 숫자를 보고 저장을 눌러야 들어간다.
  채울 때 **빈 값·0 은 덮지 않는다** — AI 가 못 읽은 항목을 빈 값으로 돌려주므로, 그대로 덮으면
  손으로 넣어 둔 값이 지워진다. 못 읽은 항목은 `missing` 으로 화면에 띄운다.
- 비교 페이지로 만들 짝은 `lib/specs/pairs.ts` 가 고른다. **가능한 조합을 전부 만들면 안 된다** —
  기종 20개면 190개인데 대부분 아무도 찾지 않고, 구글이 대량 생성 콘텐츠로 본다.
  폼팩터·등급·가격대·시기 네 가지를 다 봐야 한다. 하나라도 빼면 폴더블이 바형과 붙는다.
- ⚠️ **`/compare/[slug]` 는 한글 주소라 `params.slug` 가 인코딩된 채로 온다.**
  거기에 `encodeURIComponent` 를 또 걸면 `%` 가 `%25` 가 돼 404 가 된다. 풀고 다시 걸 것.
- ⚠️ **공개 페이지에서 `apiGet`(쿠키 읽음)을 쓰지 말 것.** `cookies()` 는 정적 생성을 막고,
  `generateStaticParams` 안에서는 아예 터진다. 로그인과 무관한 화면은 `apiGetPublic` 을 쓴다.

### 시세 리포트 (SEO·GEO)

- **`posts` 와 일부러 분리된 테이블이다** (`sise_sheets` 시세표 + `sise_reports` 글).
  사이트 목록·검색 어디에도 섞이면 안 되는 글이라, 같은 테이블에 두면 모든 조회에 필터를 걸어야 하고
  하나만 빠뜨려도 새어 나간다.
- 노출은 `/sise` 목록과 `/sise/[slug]` 상세뿐이다. **사이드바·헤더 메뉴에는 걸지 말 것.**
  목록 페이지를 두는 이유는 따로 있다 — 아무 데서도 링크 안 된 페이지(orphan page)는 구글이
  "사이트가 스스로 안 중요하다고 말하는 페이지" 로 본다. 크롤러가 타고 들어갈 길 하나는 있어야 한다.
- **표는 코드가 그리고(`components/sise/SiseTable.tsx`), AI 는 해설만 쓴다**(`lib/sise/write.ts`).
  가격까지 맡기면 환각으로 숫자가 틀어지는데, 시세 글에서 그건 오타가 아니라 사고다.
  글 쓰는 프롬프트에는 계산해둔 숫자를 미리 넣어 준다.
- **가격 단위는 만원이고 음수는 페이백이다** (-75 = 75만원 돌려줌). 비교에서 값이 내려가면
  (`delta < 0`) 손님에게 유리해진 것이다 — 할부원금이 줄었든 페이백이 늘었든 부호 하나로 표현된다.
- 흐름은 올리기 → **사람이 숫자 확인** → 저장·글 생성 → 발행이다. 확인 단계를 빼지 말 것.
  표에서 숫자 하나를 잘못 읽으면 그대로 공개된다.
- Anthropic 호출은 `lib/anthropic.ts` 한 곳에서 만든다. 키가 없으면 이 기능만 안 되고 서버는 그대로 뜬다.
  형식 강제는 **structured outputs**(`messages.parse` + `zodOutputFormat`)로 한다 —
  강제 `tool_choice` 는 최신 모델에서 400 이다.
- **모델은 읽기 `claude-haiku-5-5` / 쓰기 `claude-sonnet-5-5`.** 8개 양식 490칸을 Haiku 로 읽혀
  전부 맞는 걸 확인했다(Opus·Sonnet 과 동률, 35배 쌈). 글쓰기만 Sonnet 인 건 Haiku 가 숫자는
  맞히면서도 "존댓말로 쓴다"는 지시를 어기고 반말로 쓰기 때문이다.
- **추출 프롬프트에 "기종당 몇 칸"을 박지 말 것.** 통신사마다 요금제 열이 2개인 표(제휴/현금),
  좌우로 나뉜 표, 통신사가 가로 3분할된 표가 다 있다. 칸 수를 고정하면 모델이 지시를 지키느라
  나머지를 버린다 — 실제로 그래서 한 양식을 절반만 읽은 적이 있다.
- 읽을 게 없을 땐 모델이 note 에 적은 이유를 그대로 띄운다. 가장 흔한 원인은 **통신사 머리글이
  잘린 이미지**다 — 그건 추측하지 말고 실패하는 게 맞다.
- `logUsage` 가 호출마다 토큰·달러를 로그에 남긴다. 요금표도 `lib/anthropic.ts` 에 있으니
  모델을 바꾸면 같이 고쳐야 숫자가 맞는다.
- `sitemap.ts` / `robots.ts` 는 app 루트에 있다. **`/sise` 를 robots 로 막지 말 것** — 검색에 걸리라고 만든 글이다.

### 뉴스 수집 (SEO·GEO)

- 흐름은 **수집(RSS) → 어드민에서 사람이 고르기 → 기사 생성(초안) → 검수 후 발행**이다.
  자동 발행하지 않는다 — 퍼온 글은 한 번 읽고 내보낸다.
- 미발행 기사·기종은 **운영진에게만** 실제 주소에서 보인다(`/news/:id`, `/specs/:id` 의 `isAdmin`).
  발행 전에 화면을 확인하라고 연 길이다. 비로그인·일반 회원에게는 그대로 404 다.
- 출처를 늘리려면 `lib/news/feed.ts` 의 `SOURCES` 만 고치면 된다.
- **원문 페이지를 긁지 않는다.** RSS 가 본문 앞부분(600자 남짓)을 주므로 그걸로 충분하다.
- ⚠️ **출처 표기는 선택이 아니라 이용 조건이다.** GSMArena 는 `license.xml`(RSL)로
  `ai-summarize` 를 허용하면서 CC BY 4.0 방식 표기를 요구한다(`ai-train` 은 금지).
  그래서 `news_articles.source_name` / `source_url` 을 반드시 채우고, 화면 하단에 노출한다.
  새 출처를 더할 땐 그쪽 `license.xml` / robots 를 먼저 확인할 것.
- **번역이 아니라 재작성이다**(`lib/news/write.ts`). 번역도 복제로 보고, 구글은 번역본을
  중복 콘텐츠로 보아 원문 뒤로 민다. 사실만 골라 한국어 기사로 새로 쓴다.
- 기사 본문에서 "원문에 따르면" 같은 말을 쓰지 않게 프롬프트로 막아 두었다 — 우리 기사지
  남의 기사 소개가 아니다.
- `news_feed.guid` 가 UNIQUE 라 수집을 여러 번 돌려도 같은 글이 쌓이지 않는다.
  원문(`source_text`)은 한 달 지나면 비운다(행은 남겨야 또 안 받는다).

### 콘텐츠 사진

- 기사·기종 사진은 `images` (JSON 배열)가 정본이고 **순서가 곧 노출 순서**다.
  `thumb_url` 은 `images[0]` 에서 따 두는 파생값이라 입력으로 받지 않는다 — 두 군데서 관리하면 어긋난다.
- 어드민 입력은 `components/photo-uploader` 의 `PhotoUploader` 를 쓴다(끌어서 순서 변경).
  이 모듈은 독립 모듈이라 우리 타입을 모르므로, 변환은 `ContentAdmin.tsx` 의 `ContentPhotos` 한 곳에서만 한다.
- 목록·상세의 `Thumb` 는 `src` 를 받으면 사진을, 없으면 그라디언트 색을 그린다.
  호출하는 쪽에서 사진 유무를 따지지 말 것.
- **퍼온 기사의 원문 이미지를 가져오지 않는다.** GSMArena 의 `license.xml` 이 허용한 건 요약이지
  사진 재배포가 아니고, 그 사진 대부분은 제조사·유출자 것이라 애초에 그쪽이 넘겨줄 권리가 없다.
  사진은 제조사 뉴스룸(보도용)에서 받아 사람이 올린다.

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
- `uploads.post_id` 와 `uploads.owner` 가 **둘 다** NULL 이면 아무 데도 안 쓰인 파일이다.
  서버가 주기적으로 지운다 (`src/lib/maintenance.ts`, 기본 6시간마다 / 24시간 유예).
  끄려면 `MAINTENANCE_ENABLED=false`.
- ⚠️ **글이 아닌 콘텐츠(기사·기종)의 사진은 `owner` 로 잡는다** (`news:9` / `spec:3`).
  `post_id` 에는 posts FK 가 걸려 있어 쓸 수 없다. 연결을 빠뜨리면 사진이 **다음 날 사라진다** —
  그래서 라우트가 아니라 `repositories/content.ts` 의 저장 함수 안에서 건다.
  새로운 종류의 콘텐츠에 사진을 붙일 땐 `linkUploadsToOwner` / `unlinkUploadsOfOwner` 를 같이 걸 것.
- `S3_BUCKET` · `AWS_REGION` · `AWS_ACCESS_KEY_ID` · `AWS_SECRET_ACCESS_KEY` 가 **넷 다** 있으면
  S3, 하나라도 없으면 로컬 디스크(`UPLOAD_DIR`)에 저장한다. 라우트는 어느 쪽인지 모른다.
- 공개 주소는 `IMAGE_BASE_URL`(CloudFront)을 앞에 붙여 만든다. 비면 S3 주소를 직접 쓴다.
- **DB 에는 도메인 없는 경로만 넣는다** (`/2026-11-18/uuid.webp`). CDN 도메인이 바뀌어도 글을
  고칠 필요가 없게. 변환은 `storage.ts` 의 `toStored`(쓸 때) / `publicUrl`(읽을 때) 두 함수로만 한다.
  - 거는 곳: `repositories/posts.ts`(본문 JSON·thumb_url), `repositories/content.ts`(뉴스·스펙 썸네일),
    `routes/uploads.ts`(uploads.url), `lib/thumbnail.ts`. **프론트는 늘 전체 주소만 본다.**
  - S3 이전에 올라간 `/uploads/...` 와 외부 이미지(`https://...`)는 두 함수가 **그대로 통과**시킨다.
    섞여 있어도 되고, 옛 파일을 옮기지 않아도 계속 뜬다.
- ⚠️ **`uploads.url` 은 본문 이미지 src 와 문자열로 맞춰보는 조인 키다**
  (`linkUploadsToPost` / `relinkUploadsToPost`). 양쪽 형식이 어긋나면 글에 쓰인 이미지가 "안 쓰인 것"
  으로 분류돼 24시간 뒤 청소에 지워진다. 이미지 주소 형식을 건드릴 땐 이 경로를 반드시 같이 확인할 것.
- 저장 파일 이름은 서버가 만든다(`날짜/UUID.확장자`). 올라온 파일 이름을 그대로 쓰지 말 것 — `../` 가 섞인다.
- 멀티파트로 올라온 이미지는 `lib/multipart.ts` 의 `readImage` 로 받는다(용량·mimetype 검사 포함).
  라우트마다 스트림 읽는 코드를 또 쓰지 말 것.
- **AWS 키를 커밋하지 말 것.** `.env.local`(로컬) / 서버 `/opt/zzikko/.env.back`(운영)에만 둔다.

## 환경변수

- `.env` = 비밀이 아닌 공용 설정(포트·CORS·업로드 폴더). **git 에 올라간다.**
- `.env.local` = 비밀값(`DATABASE_URL`, `JWT_SECRET`, `AWS_*`, `S3_BUCKET`). git 에 안 올라간다.
  나중에 읽히므로 이긴다.
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

## 배포

- main 에 푸시하면 워크플로가 이미지를 올리고 `deploy/deploy.sh` 를 서버에서 돌린다. 헬스체크까지 한다.
- ⚠️ **서버에서 손으로 다시 띄울 땐 반드시 `deploy.sh` 를 쓴다.**
  - `docker compose restart` 는 `.env.back` 을 다시 읽지 않는다 (env_file 은 컨테이너를 만들 때만 읽힌다).
  - `docker compose up -d --force-recreate` 는 **이미지를 받아오지 않는다.** 태그를 안 주면 `latest` 가
    되는데, 워크플로는 늘 `sha-<커밋>` 으로 배포하므로 서버의 `latest` 는 맨 처음 받은 옛 이미지에
    멈춰 있다. 실제로 이걸로 S3 이전 코드가 올라와 운영이 죽은 적이 있다.
  - 태그 없이 `bash deploy.sh` 를 돌리면 마지막으로 성공한 배포(`.tag`)를 그대로 다시 올린다.
    환경변수만 바꿨을 때 쓰는 명령이 이것이다.

## 아직 없는 것

판매자 인증, 알림, 비밀번호 찾기, 신고, 회원 관리 어드민.
