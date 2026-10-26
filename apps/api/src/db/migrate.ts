import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Db } from './client.js';

export async function runMigrations(db: Db, migrationsFolder: string): Promise<void> {
  await migrate(db, { migrationsFolder });
}
