FROM node:22-alpine

WORKDIR /app

COPY packages/worker/package.json ./
RUN npm install --omit=dev

COPY packages/worker ./
COPY packages/worker/tsconfig.json ./

RUN npm run build

CMD ["node", "dist/index.js"]
