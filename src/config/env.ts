/**
 * Typed environment configuration.
 * All values are read once at startup. Missing required vars will throw at init time.
 */

import 'dotenv/config';

function toStringValue(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function toNumberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBooleanValue(value: unknown, fallback = false): boolean {
  if (typeof value !== 'string') {
    return fallback;
  }

  return value === 'true';
}

export const env = {
  node: {
    env: toStringValue(process.env.NODE_ENV, 'development'),
    port: toNumberValue(process.env.PORT, 3000),
    corsOrigin: toStringValue(process.env.CORS_ORIGIN, '*'),
  },
  db: {
    host: toStringValue(process.env.DB_HOST, 'localhost'),
    port: toNumberValue(process.env.DB_PORT, 5432),
    username: toStringValue(process.env.DB_USERNAME ?? process.env.POSTGRES_USER, 'nuobuddy'),
    password: toStringValue(process.env.DB_PASSWORD ?? process.env.POSTGRES_PASSWORD, 'nuobuddy'),
    database: toStringValue(process.env.DB_DATABASE ?? process.env.POSTGRES_DB, 'nuobuddy'),
    ssl: toBooleanValue(process.env.DB_SSL, false),
    synchronize: toBooleanValue(process.env.DB_SYNCHRONIZE, false),
    logging: toBooleanValue(process.env.DB_LOGGING, false),
  },
  jwt: {
    secret: toStringValue(process.env.JWT_SECRET, ''),
    expiresIn: toStringValue(process.env.JWT_EXPIRES_IN, '7d'),
  },
  smtpgo: {
    host: toStringValue(process.env.SMTOGO_API_URL ?? process.env.SMTP_HOST, ''),
    apiKey: toStringValue(process.env.SMTOGO_API_KEY ?? process.env.SMTPGO_API_KEY, ''),
  },
} as const;
