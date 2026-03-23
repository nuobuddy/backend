import { DataSource } from 'typeorm';
import { env } from './env';
import { SystemSetting } from '../entities/SystemSetting';
import { User } from '../entities/User';
import { Conversation } from '../entities/Conversation';

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
  entities: [SystemSetting, User, Conversation],
  migrations: [],
});
