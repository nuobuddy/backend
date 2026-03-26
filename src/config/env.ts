/**
 * Typed environment configuration.
 * All values are read once at startup. Missing required vars will throw at init time.
 */

import 'dotenv/config';

export const env = {
  node: {
    env: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
  },
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'nuobuddy',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE ?? 'nuobuddy',
    ssl: process.env.DB_SSL === 'true',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  dify: {
    // 数据库中的 system_settings 优先级更高；这里作为服务降级时的兜底来源。
    baseUrl: process.env.DIFY_BASE_URL ?? 'http://dify.ibuduan.com/v1',
    apiKey: process.env.DIFY_API_KEY ?? '',
  },
} as const;
