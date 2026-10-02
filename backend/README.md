# 찍고 API 서버

Fastify 5 + TypeScript + MySQL 8. 모든 엔드포인트는 `/api/v1` 아래에 있고, 웹(4050)과 이후 Flutter 앱이 같은 API 를 쓴다.

## 시작하기

```sh
npm install
cp .env.example .env
```

### 1. DB 만들기 (한 번만)

MySQL root 비밀번호를 묻습니다.

```sh
npm run db:init
```

PowerShell 은 `<` 리다이렉션을 지원하지 않아 `mysql -u root -p < src/db/schema.sql` 이 먹지 않는다.
위 스크립트는 어느 셸에서든 되는 `-e "source ..."` 방식이다.

`zzikko_cafe` 데이터베이스 + 테이블 + 로컬 개발 계정(`zzikko_cafe` / `zzikko_local_dev`)이 만들어진다.
**다시 실행하면 테이블을 지우고 새로 만든다.**

> DB 이름이 `zzikko` 가 아니라 `zzikko_cafe` 다. 같은 PC 의 `zzikko` DB 는 네이버 블로그 자동화
> 프로젝트가 쓰고 있어서 겹치지 않게 뒀다. 스키마는 `DROP TABLE` 로 시작하므로 DB 이름을 바꾸지 말 것.

### 1-1. 비밀값 채우기

```sh
cp .env.example .env.local
```

`.env` (포트·CORS 같은 공용 설정)는 git 으로 같이 받으므로 따로 만들 필요가 없다.
`.env.local` 에는 `DATABASE_URL` 과 `JWT_SECRET` 을 넣는다. `JWT_SECRET` 이 없으면 서버가 뜨지 않는다.

```sh
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 2. 초기 데이터 넣기

```sh
npm run db:seed
```

게시판·회원·매장·게시글·댓글·기종 사양·기사가 들어간다. 여러 번 돌려도 된다(매번 비우고 다시 넣음).

데모 계정 비밀번호는 모두 `zzikko1234`.

| 계정 | 역할 |
| --- | --- |
| `admin@zzikko.test` | 운영진 (어드민 접근) |
| `me@zzikko.test` | 일반 회원 |
| `gangnam@zzikko.test` | 판매자 (시세 글 작성 가능) |

### 3. 실행

```sh
npm run dev      # http://127.0.0.1:4080
npm run typecheck
npm run build && npm start
```

## 구조

```
src/
├── server.ts            진입점 (PORT, HOST)
├── app.ts               Fastify 조립 — CORS·쿠키·JWT·업로드·정적파일·에러 처리
├── routes/              HTTP 만 다룬다 (입력 검증 → 저장소 호출 → 응답)
│   ├── index.ts         게시판·매장·어드민 통계 + 하위 라우트 등록
│   ├── auth.ts          가입·로그인·로그아웃·내 정보
│   ├── posts.ts         게시글·댓글·좋아요
│   ├── content.ts       IT 소식·기종 사양·칩셋 (공개 조회 + 어드민 CRUD)
│   └── uploads.ts       이미지 업로드
├── repositories/        SQL 은 여기에만 있다. 라우트는 SQL 을 모른다
├── lib/
│   ├── auth.ts          비밀번호 해시(scrypt), 세션 쿠키, 권한 검사
│   ├── editor.ts        본문 JSON → 평문·썸네일 추출
│   └── http.ts          오류 형태와 zod 검증
└── db/
    ├── pool.ts          커넥션 풀 + query/execute/트랜잭션 헬퍼
    └── schema.sql       테이블 정의
```

**라우트 ↔ 저장소 분리를 지킨다.** 라우트에 SQL 을 쓰지 말고, 저장소에서 HTTP 응답을 만들지 않는다.
DB 컬럼은 `snake_case`, API 응답은 `camelCase` — 변환은 저장소 안에서 한다.

## API

| 메서드 | 경로 | 설명 |
| --- | --- | --- |
| POST | `/auth/signup` `/auth/login` `/auth/logout` | 가입 · 로그인 · 로그아웃 |
| GET | `/auth/me` | 내 정보 (로그인 필요) |
| GET | `/boards` `/boards/:slug` | 게시판 목록(대분류→소분류), 게시판 하나 |
| GET | `/posts` | 목록. `boardSlug` `category` `region` `q` `sort` `page` `size` `authorId` `shopId` |
| GET | `/posts/:id` | 상세 (조회수 +1) |
| POST | `/posts` | 글쓰기 (로그인 필요) |
| POST | `/posts/:id/like` | 좋아요 토글 |
| GET/POST | `/posts/:id/comments` | 댓글 목록 · 작성 |
| GET | `/shops` `/shops/:slug` | 판매자 매장, 매장 + 올린 시세 |
| GET | `/news` `/news/:id` | IT 소식 (발행된 것만) |
| GET | `/specs` `/specs/:id` `/chipsets` | 기종 사양·칩셋 |
| POST/PATCH/DELETE | `/admin/news/*` `/admin/specs/*` `/admin/chipsets/*` | 콘텐츠 관리 (운영진) |
| PATCH | `/admin/boards/:slug` | 게시판 설정 (운영진) |
| GET | `/admin/stats` | 대시보드 지표 (운영진) |
| POST | `/uploads/image` | 이미지 업로드 (로그인 필요). `/uploads/...` 로 서빙 |

오류는 `{ message, issues? }` 형태로 내려간다. 입력 검증 실패는 400, 비로그인 401, 권한 없음 403, 없는 항목 404.

## 알아둘 것

- **본문 정본은 ProseMirror JSON**(`posts.content_json`). 브라우저가 만든 HTML 을 저장하지 않으므로
  본문에 `<script>` 가 섞여 들어올 경로가 없다. 서버는 검색·미리보기용 평문(`content_text`)만 따로 뽑아 둔다.
- **비밀번호는 node 내장 scrypt** 로 해시한다(`salt:hash`). bcrypt 네이티브 모듈을 깔지 않아도 된다.
- **로그인은 httpOnly 쿠키**에 담은 JWT. 자바스크립트로 토큰을 읽을 수 없다.
- **시세 글의 매장은 서버가 정한다.** 글쓴이의 매장으로 붙이므로 남의 매장 이름으로 올릴 수 없다.
- **업로드 파일 이름은 서버가 만든다.** 올라온 이름을 그대로 쓰면 경로나 확장자가 섞여 들어올 수 있다.
- 칩셋은 벤치 점수 대신 **4단계 등급**으로만 비교한다. 쓰고 있는 칩셋은 FK(RESTRICT)로 삭제가 막힌다.

## 아직 없는 것

이메일 인증, 비밀번호 찾기, 판매자 인증 심사, 신고 처리, 이미지 리사이즈, 레이트 리밋.
