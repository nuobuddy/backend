# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "if [ -f dist/scripts/migration-run.js ]; then node dist/scripts/migration-run.js; elif [ -f dist/migration-run.js ]; then node dist/migration-run.js; else echo 'Migration runner not found, skipping migrations.'; fi && node dist/main.js"]
