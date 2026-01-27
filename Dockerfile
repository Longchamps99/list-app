# Use a common base to ensure openssl is available everywhere
FROM node:20-bullseye-slim AS base
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

# Stage 1: Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Add a cache-busting argument to force npm ci to run if needed
ARG CACHEBUST=1
RUN npm ci

# Stage 2: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client using local binary. Base image has openssl, so detection works.
RUN ./node_modules/.bin/prisma generate
# Build the application
RUN npm run build

# Stage 3: Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# Copy essential files for standalone output
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Copy necessary node_modules (including Prisma CLI)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Copy prisma directory for startup migrations
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Grant write permissions to the /app directory for SQLite
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME="0.0.0.0"

# Run Prisma initialization on startup
CMD ./node_modules/.bin/prisma db push --accept-data-loss && node server.js
