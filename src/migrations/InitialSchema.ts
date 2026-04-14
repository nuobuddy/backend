import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial database schema migration.
 * Creates users, conversations, and system_settings tables.
 */
export class InitialSchema2026041200000 implements MigrationInterface {
  name = 'InitialSchema2026041200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "username" varchar NOT NULL UNIQUE,
        "email" varchar NOT NULL UNIQUE,
        "passwordHash" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'user',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Create conversations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "difyConversationId" varchar,
        "title" varchar,
        "share" boolean NOT NULL DEFAULT false,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_conversations_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Backfill share column for older schemas
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN IF NOT EXISTS "share" boolean NOT NULL DEFAULT false
    `);

    // Create messages table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "role" varchar NOT NULL,
        "content" text NOT NULL,
        "attachments" jsonb,
        "conversationId" uuid NOT NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_messages_conversationId" FOREIGN KEY ("conversationId")
          REFERENCES "conversations"("id") ON DELETE CASCADE
      )
    `);

    // Create system_settings table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_settings" (
        "key" varchar PRIMARY KEY,
        "value" text NOT NULL,
        "description" varchar,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conversations_userId" ON "conversations" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_conversationId" ON "messages" ("conversationId")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_username" ON "users" ("username")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_users_email"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_users_username"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_messages_conversationId"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_conversations_userId"');

    // Drop tables
    await queryRunner.query('DROP TABLE IF EXISTS "messages"');
    await queryRunner.query('DROP TABLE IF EXISTS "system_settings"');
    await queryRunner.query('DROP TABLE IF EXISTS "conversations"');
    await queryRunner.query('DROP TABLE IF EXISTS "users"');
  }
}
