# syntax=docker/dockerfile:1

FROM node:20-slim AS base

WORKDIR /app

# Prisma CLI / OpenSSL 依存をインストール
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# 依存関係をインストール
COPY package*.json ./
RUN npm install

# Prismaクライアントを生成
COPY prisma ./prisma
RUN npm run prisma:generate

# アプリケーションコードをコピー
COPY . .

ENV NODE_ENV=development

CMD ["npm", "run", "dev:stable"]

