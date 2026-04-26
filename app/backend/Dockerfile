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
COPY app/backend/ ./
COPY --from=deps /app/node_modules ./node_modules
RUN npx prisma generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./

EXPOSE 8080
CMD ["npm", "start"]
