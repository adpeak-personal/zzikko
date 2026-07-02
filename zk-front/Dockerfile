# ─── Build stage ────────────────────────────────────────────
# Next.js 빌드를 수행. NEXT_PUBLIC_* 는 이 단계에서 클라이언트 번들에 박힌다.
FROM node:20-alpine AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat

COPY package*.json ./
RUN npm ci

COPY . .

# 클라이언트 번들에 박힐 백엔드 URL — 브라우저가 직접 접근할 수 있는 주소.
# 로컬 도커 테스트: http://localhost:3041 / 운영: https://api.example.com 등
ARG NEXT_PUBLIC_BACK_API="http://localhost:3041"
ENV NEXT_PUBLIC_BACK_API=$NEXT_PUBLIC_BACK_API

# SEO — 네이버 서치어드바이저 / Google Search Console 소유확인 메타 태그 값.
# 미설정 시 태그 자체가 삽입되지 않아 무해. 등록 후 값 채워서 재빌드하면 <head> 에 자동 삽입.
ARG NEXT_PUBLIC_NAVER_SITE_VERIFICATION=""
ENV NEXT_PUBLIC_NAVER_SITE_VERIFICATION=$NEXT_PUBLIC_NAVER_SITE_VERIFICATION
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=""
ENV NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION

# 운영 도메인 오버라이드 (기본 https://zzikko.co.kr) — canonical / sitemap / RSS 절대 URL 기준.
ARG NEXT_PUBLIC_SITE_URL=""
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

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
