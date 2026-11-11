# 찍고 백엔드 (Fastify). GitHub Actions 가 빌드해 GHCR 에 올린다 (.github/workflows/deploy.yml).
# sharp 의 미리 빌드된 바이너리가 glibc 용이라 alpine 대신 slim 을 쓴다.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
# .env 는 이미지에 넣지 않는다(.dockerignore). 비밀값은 서버의 .env.back 으로 들어온다.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4080 \
    UPLOAD_DIR=uploads \
    TZ=Asia/Seoul
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# 마이그레이션은 컨테이너 안에서 돌린다: docker compose exec back node scripts/migrate.mjs --yes
COPY scripts ./scripts
COPY src/db/schema.sql ./src/db/schema.sql
# 업로드 폴더는 서버의 /opt/zzikko/uploads 를 붙인다 — node(1000) 가 쓸 수 있어야 한다
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 4080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4080/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
