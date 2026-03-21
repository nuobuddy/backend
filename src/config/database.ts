import { DataSource } from 'typeorm';
import { User } from '@/entities/User';
import { Conversation } from '@/entities/Conversation';
import { SystemSetting } from '@/entities/SystemSetting';
import { InitialSchema } from '@/migrations/InitialSchema';
import { env } from './env';

export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.db.host,
  port: env.db.port,
  username: env.db.username,
  password: env.db.password,
  database: env.db.database,
  ssl: env.db.ssl ? { rejectUnauthorized: false } : false,
  synchronize: env.db.synchronize,
  logging: env.db.logging,
  entities: [User, Conversation, SystemSetting],
  migrations: [InitialSchema],
});
