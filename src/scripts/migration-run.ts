import 'reflect-metadata';
import { AppDataSource } from '@/config/database';

async function runMigrations(): Promise<void> {
  try {
    await AppDataSource.initialize();
    const migrations = await AppDataSource.runMigrations();

    if (migrations.length === 0) {
      console.log('No pending migrations.');
    } else {
      console.log(`Applied ${migrations.length} migration(s).`);
      migrations.forEach((migration) => {
        console.log(`- ${migration.name}`);
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to run migrations:', message);
    process.exitCode = 1;
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

runMigrations().catch(() => {
  process.exitCode = 1;
});
