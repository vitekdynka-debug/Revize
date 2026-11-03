import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { parseIntoClientConfig } from 'pg-connection-string';
import * as schema from './schema.js';

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** Repositories accept either the database or a running transaction. */
export type DbOrTx = Db | Tx;

export interface Database {
  db: Db;
  pool: pg.Pool;
  close(): Promise<void>;
}

/**
 * `password` (optional) is passed apart from the URL, so that it may contain characters that
 * would need URL encoding. pg ignores a separate password next to `connectionString`, hence the
 * URL is parsed into a config first.
 */
export function createDatabase(url: string, password?: string): Database {
  const pool = new pg.Pool(
    password === undefined
      ? { connectionString: url, max: 10 }
      : { ...parseIntoClientConfig(url), password, max: 10 },
  );
  const db = drizzle(pool, { schema, casing: 'snake_case' });
  return { db, pool, close: () => pool.end() };
}
