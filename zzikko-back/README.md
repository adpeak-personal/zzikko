# zzikko-back

Fastify + TypeScript 백엔드 (MySQL).

## 요구사항

- Node.js 22+
- MySQL 8 (`zzikko_structure.sql` 스키마)

## 시작하기

```bash
npm install

# 환경변수 준비 후 DB 접속 정보 입력
cp .env.example .env   # Windows: copy .env.example .env

npm run dev            # 개발 모드 (tsx watch, http://localhost:4000)
```

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (핫 리로드) |
| `npm run build` | `dist/`로 컴파일 |
| `npm start` | 빌드 결과 실행 |
| `npm run typecheck` | 타입 검사만 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 포맷 |

## 구조

```
src/
  main.ts          # 진입점 (listen, 그레이스풀 셧다운)
  app.ts           # 앱 빌더 (플러그인/라우트 등록)
  config/env.ts    # @fastify/env 환경변수 검증 → app.config
  plugins/db.ts    # mysql2 커넥션 풀 → app.db
  routes/
    health.ts      # GET /health, /health/db
    users.ts       # GET /api/users, /api/users/:id (예시)
```

## 엔드포인트

- `GET /health` — 서버 상태
- `GET /health/db` — DB 연결 확인
- `GET /api/users` — 유저 목록 (예시)
- `GET /api/users/:id` — 유저 단건 (예시)
