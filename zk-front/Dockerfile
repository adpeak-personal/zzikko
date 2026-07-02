# ─── Build stage ────────────────────────────────────────────
# Next.js 빌드를 수행. NEXT_PUBLIC_* 는 이 단계에서 클라이언트 번들에 박힌다.
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

COPY . .

# 모든 NEXT_PUBLIC_* (BACK_API, SEO verification, SITE_URL 등) 은 zk-front/.env 에서 관리.
# .dockerignore 가 .env 를 이미지에 포함시키고, next build 가 자동으로 읽어 클라이언트 번들에 박는다.
# 여기서 ARG/ENV 로 미리 세팅하면 .env 값이 덮여쓰기 되니 세팅하지 않는다.
RUN npm run build


# ─── Runtime stage ──────────────────────────────────────────
# next start 가 .next + node_modules 만 있으면 동작하도록 슬림하게 구성.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=Asia/Seoul

RUN apk add --no-cache libc6-compat tzdata \
 && cp /usr/share/zoneinfo/Asia/Seoul /etc/localtime \
 && echo "Asia/Seoul" > /etc/timezone

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# SSR 에서 백엔드 호출 시 사용될 컨테이너 내부 URL.
# docker-compose 의 environment 에서 override (예: http://backend:4000).
# 미설정 시 빌드 때 박힌 NEXT_PUBLIC_BACK_API 로 폴백.
# INTERNAL_BACK_API 는 컨테이너 안에서만 의미 있고 클라이언트엔 노출되지 않음.

EXPOSE 3040

CMD ["npm", "run", "start"]
