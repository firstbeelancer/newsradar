FROM node:22-alpine

WORKDIR /app

COPY packages/api/package.json ./
RUN npm install --omit=dev

COPY packages/api ./
COPY packages/api/tsconfig.json ./

RUN npm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
