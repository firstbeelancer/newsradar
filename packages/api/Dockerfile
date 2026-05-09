# ==========================================
# Newsradar API — Multi-Stage Production Build
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

COPY packages/api/package.json ./
RUN npm install

COPY packages/api ./
RUN npm run build

FROM node:22-alpine AS production

WORKDIR /app

COPY --from=builder /app/package.json ./
RUN npm install --production

COPY --from=builder /app/dist ./dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
