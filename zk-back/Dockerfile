# ─── Build stage ────────────────────────────────────────────
# tsc 로 빌드만 수행. 빌드용 의존성(ts-node-dev, typescript 등) 포함.
FROM node:20-alpine AS builder
WORKDIR /app

# sharp 등 네이티브 모듈을 위한 호환 라이브러리
RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

# tsconfig.json 의 include 에 들어있는 디렉터리만 복사 (캐시 효율)
COPY tsconfig.json ./
COPY main.ts ./
COPY lib ./lib
COPY routes ./routes

RUN npm run build


# ─── Runtime stage ──────────────────────────────────────────
# 프로덕션 의존성만 설치한 슬림 이미지.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# 이미지 자체를 KST 로 고정 — docker-compose 의 TZ env 로도 override 가능
ENV TZ=Asia/Seoul

# libc6-compat: sharp 등 네이티브 모듈 호환
# tzdata: KST 를 실제 적용시키려면 필요 (alpine 기본에 없음)
# /etc/localtime + /etc/timezone: 셸의 date 명령 및 libc 가 KST 로 인식하게 만듦
RUN apk add --no-cache libc6-compat tzdata \
 && cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
 && echo "Asia/Seoul" > /etc/timezone

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# 빌드 산출물만 가져온다
COPY --from=builder /app/dist ./dist

# main.ts 기본값 — docker-compose 에서 override 가능
ENV PORT=4000
ENV HOST=0.0.0.0

EXPOSE 4000

# dotenv/config 가 main.ts 첫 줄에서 import — 컨테이너 내 .env 가 없어도
# docker-compose 의 env_file 로 process.env 에 주입되므로 정상 동작.
CMD ["node", "dist/main.js"]
