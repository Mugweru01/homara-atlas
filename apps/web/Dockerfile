FROM oven/bun:1 AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js or Vite build (we'll assume Vite for now based on vite.config.ts)
RUN bun run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
# Add a non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 webapp
USER webapp

COPY --from=builder /app/dist ./dist
# If using a specific web server to serve static files, we'd add it here.
# Assuming a basic bun static server for demonstration:
CMD ["bun", "x", "serve", "dist", "-p", "3000"]
