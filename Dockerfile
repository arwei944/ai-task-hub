FROM node:20-alpine AS base

# Install build dependencies for native modules (better-sqlite3)
RUN apk add --no-cache libc6-compat python3 make g++ wget

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

# Verify native module build
RUN test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node || (echo "FATAL: native build failed" && exit 1)

# Copy source code
COPY . .

# Generate Prisma client and create database
RUN npx prisma generate && \
    mkdir -p /data && \
    npx prisma db push --accept-data-loss 2>&1 && \
    test -f /data/dev.db || (echo "FATAL: DB creation failed" && exit 1)

# Build Next.js
RUN npx next build

# Setup startup script
RUN chmod +x start.sh

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/dev.db
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

EXPOSE 3000

CMD ["sh", "-c", "npx prisma generate && npx next start"]
