# ==========================================
# Newsradar API — Quick Deploy (tsx for now)
# ==========================================
FROM node:22-alpine

WORKDIR /app

COPY packages/api/package.json ./
RUN npm install

COPY packages/api ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
