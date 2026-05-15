FROM node:22-alpine AS builder

WORKDIR /app

COPY packages/web/package.json ./
RUN npm install

COPY packages/web ./
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
# force rebuild Sat May 16 02:33:13 AM CST 2026
