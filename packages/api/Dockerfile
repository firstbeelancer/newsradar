# ==========================================
# Newsradar API — Quick Deploy (tsx for now)
# ==========================================
FROM node:22-alpine

WORKDIR /app

# Copy package files first for layer caching
COPY packages/api/package.json ./
RUN npm install

# Copy source code (invalidates cache when files change)
COPY packages/api ./

# Force rebuild timestamp — change this to trigger Coolify rebuild
# Last updated: 2026-05-20-force-rebuild
ARG CACHEBUST=1

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
# rebuild 1779226377
# rebuild trigger 1779226898
# deploy trigger 1779227337
