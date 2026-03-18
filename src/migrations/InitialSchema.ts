import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial database schema migration.
 * Creates users, conversations, and system_settings tables.
 */
export class InitialSchema implements MigrationInterface {
  name = 'InitialSchema';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
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
      CREATE TABLE "conversations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "difyConversationId" varchar,
        "title" varchar,
        "userId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "FK_conversations_userId" FOREIGN KEY ("userId")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create system_settings table
    await queryRunner.query(`
      CREATE TABLE "system_settings" (
        "key" varchar PRIMARY KEY,
        "value" text NOT NULL,
        "description" varchar,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_userId" ON "conversations" ("userId")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_username" ON "users" ("username")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_email" ON "users" ("email")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query('DROP INDEX "IDX_users_email"');
    await queryRunner.query('DROP INDEX "IDX_users_username"');
    await queryRunner.query('DROP INDEX "IDX_conversations_userId"');

    // Drop tables
    await queryRunner.query('DROP TABLE "system_settings"');
    await queryRunner.query('DROP TABLE "conversations"');
    await queryRunner.query('DROP TABLE "users"');
  }
}
