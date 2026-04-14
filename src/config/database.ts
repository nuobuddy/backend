import { DataSource } from 'typeorm';
import { User } from '@/entities/User';
import { Conversation } from '@/entities/Conversation';
import { Message } from '@/entities/Message';
import { SystemSetting } from '@/entities/SystemSetting';
import { InitialSchema2026041200000 } from '@/migrations/InitialSchema';
import { AddMessageAttachments2026041400000 } from '@/migrations/AddMessageAttachments2026041400000';
import { env } from './env';

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
  entities: [User, Conversation, Message, SystemSetting],
  migrations: [InitialSchema2026041200000, AddMessageAttachments2026041400000],
});
