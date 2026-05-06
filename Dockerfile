# syntax=docker/dockerfile:1.7

# ---------- Stage 1: deps + build ----------
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# better-sqlite3 のネイティブビルドに必要 (python3 / make / g++)
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# 依存解決。postinstall で `prisma generate` が走るので schema を先に置く。
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ソース投入 → Next.js ビルド
COPY . .
# Next.js 16 は build 時の "Collecting page data" で実 import を走らせるため、
# Prisma を初期化する route が DATABASE_URL を要求する。実 DB は不要なのでビルド用ダミー値を渡す。
ENV DATABASE_URL="file:/tmp/build-placeholder.db" \
    SESSION_SECRET="build-time-placeholder-secret-not-used-at-runtime"
RUN npx next build

# ---------- Stage 2: runtime ----------
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

# 実行時にも better-sqlite3 のネイティブモジュールが動くため、
# node-gyp で再ビルドが必要になった場合に備えて build-essential 相当を残す。
# また openssl は Prisma engine の依存。
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ca-certificates openssl \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8050

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/app ./app
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/proxy.ts ./proxy.ts
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
COPY docker/app/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8050

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["npm", "start"]
