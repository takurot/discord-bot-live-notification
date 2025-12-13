# syntax=docker/dockerfile:1

FROM node:20-slim AS deps
WORKDIR /app

# Prisma CLI / OpenSSL 依存をインストール
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 依存関係をインストール（CIと同じ npm ci を利用）
COPY package*.json ./
RUN npm ci

FROM deps AS build
COPY prisma ./prisma
RUN npm run prisma:generate

COPY tsconfig.json tsconfig.jest.json jest.config.js ./
COPY src ./src

RUN npm run build
RUN npm prune --production

FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package*.json ./

EXPOSE 3000

CMD ["node", "dist/bot/index.js"]
