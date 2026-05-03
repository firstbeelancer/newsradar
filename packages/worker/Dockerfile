# ==========================================
# Newsradar Worker — Multi-Stage Production Build
# ==========================================
# Runs TypeScript directly with tsx because the worker depends on local
# TypeScript sources during this deploy wave.
FROM node:22-alpine AS production

WORKDIR /app

COPY packages/worker/package.json ./
RUN npm install

COPY packages/worker ./

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD node healthcheck.mjs

CMD ["npx", "tsx", "src/index.ts"]
