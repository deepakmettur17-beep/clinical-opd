FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY app/backend/package.json app/backend/package-lock.json ./
RUN npm install

FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
# Prisma 7 generate (paths are relative to app/backend if running there)
WORKDIR /app/backend
RUN npx prisma generate

FROM base AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
# No longer need PRISMA_CLIENT_ENGINE_TYPE=binary in P7 with adapters
COPY --from=builder /app/backend ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 8080
CMD ["npm", "start"]
