# ==========================================
# Newsradar Worker — Multi-Stage Production Build
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY packages/worker/package.json ./
RUN npm install

COPY packages/worker ./
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

COPY --from=builder /app/package.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD node healthcheck.mjs

CMD ["node", "dist/index.js"]
