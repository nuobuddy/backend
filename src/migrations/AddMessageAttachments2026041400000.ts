import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageAttachments2026041400000 implements MigrationInterface {
  name = 'AddMessageAttachments2026041400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachments" jsonb',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "messages" DROP COLUMN IF EXISTS "attachments"',
    );
  }
}
