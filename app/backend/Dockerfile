FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY app/backend/package.json app/backend/package-lock.json ./
RUN npm install

FROM base AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./app/backend/node_modules
RUN cd app/backend && npx prisma generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
RUN cd app/backend && npm prune --omit=dev

EXPOSE 8080
CMD ["npm", "start"]
