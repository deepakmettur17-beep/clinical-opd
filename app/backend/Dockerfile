FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /src
# Copy the entire monorepo into /src
COPY . .
# Build Frontend
WORKDIR /src/app/frontend-react
RUN npm install
RUN npm run build
# Now the backend is at /src/app/backend
WORKDIR /src/app/backend
RUN npm install
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
# Copy only the backend folder from builder to the runner's /app
COPY --from=builder /src/app/backend ./
# Copy the built frontend into a 'public' directory
COPY --from=builder /src/app/frontend-react/build ./public
# Remove dev dependencies
RUN npm prune --omit=dev

EXPOSE 8080
CMD ["npm", "start"]
