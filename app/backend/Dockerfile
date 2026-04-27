FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Install ALL dependencies including devDeps for the builder
RUN npm install

FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
# Generate prisma client using the local prisma CLI
RUN npx prisma generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PRISMA_CLIENT_ENGINE_TYPE=library
COPY --from=builder /app ./
# Prune dev dependencies for production
RUN npm prune --omit=dev

EXPOSE 8080
CMD ["npm", "start"]
