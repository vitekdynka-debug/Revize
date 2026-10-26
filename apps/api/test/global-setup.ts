import { randomBytes } from 'node:crypto';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { createDatabase } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrate.js';

// Any PostgreSQL 16 server the tests may create databases on, e.g. `pnpm db:test`.
const SERVER_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Creates a fresh, migrated database for this test run and drops it afterwards. */
export default async function setup(project: TestProject) {
  const name = `revize_test_${randomBytes(4).toString('hex')}`;
  const admin = new pg.Client({ connectionString: SERVER_URL });
  try {
    await admin.connect();
  } catch (error) {
    throw new Error(
      `API tests need PostgreSQL at ${SERVER_URL} (set TEST_DATABASE_URL or run \`pnpm db:test\`)`,
      { cause: error },
    );
  }
  await admin.query(`create database ${name}`);
  const url = new URL(SERVER_URL);
  url.pathname = `/${name}`;

  const database = createDatabase(url.toString());
  await runMigrations(database.db, new URL('../drizzle', import.meta.url).pathname);
  await database.close();
  project.provide('databaseUrl', url.toString());

  return async () => {
    await admin.query(`drop database if exists ${name} with (force)`);
    await admin.end();
  };
}
