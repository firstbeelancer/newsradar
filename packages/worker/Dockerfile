# ==========================================
# Newsradar Worker — Multi-Stage Production Build
# ==========================================
# Stage 1: Builder — installs ALL deps (dev + prod), compiles TypeScript
# Stage 2: Production — only prod deps + compiled dist/

# ─── Stage 1: Builder ────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY packages/worker/package.json ./
RUN npm install

COPY packages/worker ./

RUN npm run build

# ─── Stage 2: Production ─────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY packages/worker/package.json ./
RUN npm install --omit=dev

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://newsradar-api:3001/api/v1/health/deep | grep -q '"worker".*"up"' || exit 1

CMD ["node", "dist/index.js"]
