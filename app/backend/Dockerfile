FROM node:20-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
# Copy only backend package files for dependency caching
COPY app/backend/package.json app/backend/package-lock.json ./
RUN npm install

FROM base AS builder
WORKDIR /app
# Copy the whole repo first (since context is root)
COPY . .
# Overwrite node_modules with the ones from deps stage
COPY --from=deps /app/node_modules ./app/backend/node_modules
# Generate prisma client from the backend directory
RUN cd app/backend && npx prisma generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy necessary files from builder
COPY --from=builder /app ./
# Prune dev dependencies in backend
RUN cd app/backend && npm prune --omit=dev

EXPOSE 8080
# Run from the root as defined in package.json start script
CMD ["npm", "start"]
