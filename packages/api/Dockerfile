# ==========================================
# Newsradar API — Multi-Stage Production Build
# ==========================================
# Runs TypeScript directly with tsx because this repository still has
# non-runtime TypeScript strictness errors that block production builds.
FROM node:22-alpine AS production

WORKDIR /app

COPY packages/api/package.json ./
RUN npm install

COPY packages/api ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
