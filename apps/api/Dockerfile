FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @blockchain-tickets/api... 2>/dev/null || \
    pnpm install --filter @blockchain-tickets/api...

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build
RUN pnpm --filter @blockchain-tickets/shared build
RUN pnpm --filter @blockchain-tickets/api build

# Prisma generate
WORKDIR /app/apps/api
RUN npx prisma generate

EXPOSE 3000
CMD ["node", "dist/index.js"]
