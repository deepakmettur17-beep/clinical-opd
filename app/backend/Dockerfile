FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
COPY . .
# Install all dependencies (in the root or app/backend?)
# The package.json is in app/backend
WORKDIR /app/backend
RUN npm install
RUN npx prisma generate

FROM base AS runner
WORKDIR /app/backend
ENV NODE_ENV=production
COPY --from=builder /app/backend ./
# Prune dev dependencies
RUN npm prune --omit=dev

EXPOSE 8080
CMD ["npm", "start"]
