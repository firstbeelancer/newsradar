# ==========================================
# Newsradar Worker — Quick Deploy (tsx for now)
# ==========================================
FROM node:22-alpine

WORKDIR /app

COPY packages/worker/package.json ./
RUN npm install

COPY packages/worker ./

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD node healthcheck.mjs

CMD ["npx", "tsx", "src/index.ts"]
