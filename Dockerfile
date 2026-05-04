FROM node:20-alpine AS base

# Install build dependencies for native modules (better-sqlite3, sharp, etc.)
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    wget \
    vips-dev \
    git \
    cmake

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./

# Enable corepack and install
RUN corepack enable pnpm && corepack prepare pnpm@10.33.2 --activate

# Set npm config for native builds
ENV npm_config_build_from_source=true

# Install all dependencies (including devDependencies for build time)
RUN pnpm install --frozen-lockfile

# Verify native module build
RUN test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node || \
    (echo "FATAL: native build failed, rebuilding..." && \
     cd node_modules/better-sqlite3 && npm run build-release && \
     cd ../.. && \
     test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node || \
     (echo "FATAL: native build still failed" && exit 1))

# Copy source code
COPY . .

# Generate Prisma client (respecting prisma.config.ts if present)
RUN npx prisma generate

# Build Next.js
RUN npx next build

# Clean up dev dependencies to reduce image size
RUN pnpm prune --prod || true

# Setup startup script
RUN chmod +x start.sh

ENV NODE_ENV=production
ENV DATABASE_URL=file:/data/dev.db
ENV PORT=7860
ENV HOSTNAME="0.0.0.0"

# Persistent storage for database
VOLUME ["/data"]

EXPOSE 7860

# Startup: ensure DB exists, then start
CMD ["sh", "-c", "mkdir -p /data && npx prisma db push --accept-data-loss 2>&1 && sh start.sh"]