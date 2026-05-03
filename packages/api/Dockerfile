# ==========================================
# Newsradar API — Multi-Stage Production Build
# ==========================================
# Stage 1: Builder — installs ALL deps (dev + prod), compiles TypeScript
# Stage 2: Production — only prod deps + compiled dist/

# ─── Stage 1: Builder ────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY packages/api/package.json ./
RUN npm install

COPY packages/api ./

RUN npm run build

# ─── Stage 2: Production ─────────────────
FROM node:22-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY packages/api/package.json ./
RUN npm install --omit=dev

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/index.js"]
