# ==========================================
# Newsradar API — Quick Deploy (tsx for now)
# ==========================================
FROM node:22-alpine

WORKDIR /app

# Copy package files first for layer caching
COPY packages/api/package.json ./
RUN npm install

# Force rebuild — must be before COPY so it invalidates the cache layer
ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST"

# Copy source code (invalidates cache when files change)
COPY packages/api ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
# rebuild 1747747200
