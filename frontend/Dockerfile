# 찍고 프론트 (Next.js standalone). GitHub Actions 가 빌드해 GHCR 에 올린다.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# next.config.ts 의 rewrites(/api, /uploads → 백엔드)는 빌드할 때 박힌다.
# compose 안에서 백엔드 서비스 이름이 back 이다.
ARG API_URL=http://back:4080
ENV API_URL=$API_URL \
    NEXT_TELEMETRY_DISABLED=1
# public 이 비어 있으면 git 에 안 올라가서 아래 COPY 가 깨진다 — 없으면 만든다
RUN mkdir -p public && npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4050 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Seoul
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 4050
CMD ["node", "server.js"]
