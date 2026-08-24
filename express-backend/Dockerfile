# ---------- Builder ----------
FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm exec prisma generate && pnpm run build

# ---------- Runtime ----------
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init \
    && addgroup -S nodejs && adduser -S nodejs -G nodejs

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate \
    && pnpm install --frozen-lockfile --prod \
    && pnpm store prune

# The Prisma CLI must match @prisma/client exactly, so it is pinned to the same version.
RUN npm install -g prisma@7.9.1 && npm cache clean --force

# Compiled output. dist/ already contains src/, prisma/ and generated/,
# so every relative import resolves inside it without extra copies.
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=builder /app/prisma/migrations ./prisma/migrations
COPY prisma.config.runtime.js ./prisma.config.js

COPY --chmod=0755 docker-entrypoint.sh ./

ENV NODE_ENV=production
EXPOSE 4000
USER nodejs

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT:-4000}${API_PREFIX:-/api}/health/ready" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh", "node", "dist/src/index.js"]
