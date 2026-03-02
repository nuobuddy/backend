import { DataSource } from 'typeorm';
import { env } from './env';

/**
 * TypeORM DataSource instance.
 * Entities and migrations are registered here as they are added.
 *
 * Call `AppDataSource.initialize()` once at application startup.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.db.host,
  port: env.db.port,
  username: env.db.username,
  password: env.db.password,
  database: env.db.database,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
  synchronize: env.db.synchronize,
  logging: env.db.logging,
  entities: [],
  migrations: [],
});
